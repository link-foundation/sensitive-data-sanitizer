import { labels } from './rules.js';
import { escapePattern, REDACTED } from './detection.js';
import { credentialPlaceholder, referencePrefix } from './credentials.js';
import { servicePath } from './public.js';
import { plausiblePerson } from './names.js';

// Bounded vocabularies are explicit so the short PASS/PW forms do not match
// unrelated words such as passport. Verb forms cover the supported locales.
export const credentialVerbs = [
  'is',
  'was',
  'equals',
  'es',
  'era',
  'est',
  'était',
  'ist',
  'war',
  'é',
  'era',
  'это',
  'равен',
  'был',
  'была',
  'было',
  'будет',
  'составляет',
  '是',
  '为',
  '為',
  'は',
  'です',
  '은',
  '는',
  '입니다',
  'هو',
  'هي',
  'היא',
  'הוא',
  'है',
  'था',
  'adalah',
  'ialah',
  'là',
  'คือ',
];
const verbs = credentialVerbs.map(escapePattern).join('|');
const key = `(?:[\\p{L}\\p{N}]+[_.-])*(?:auth|authorization)(?:[_.-][\\p{L}\\p{N}]+)*|[\\p{L}\\p{N}_.-]{0,32}(?:${labels.credential
  .filter((word) => !['auth', 'authorization'].includes(word))
  .map(escapePattern)
  .join(
    '|'
  )})[\\p{L}\\p{N}_.-]{0,32}|(?:[\\p{L}\\p{N}_.-]{1,32}[_-])?(?:pass|pw)(?:[_-][\\p{L}\\p{N}_.-]{1,32})?`;
// A qualifier such as "for staging" stays on one logical line: it never
// crosses an escaped line break, an escape sequence or an enclosing quote.
// Verbs are whole words, so "request" does not end in the verb "est".
const credentialPrefix = new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:\\\\*["'])?(${key})(?![\\p{L}\\p{N}_])(?:\\\\*["'])?(?:[ \\t]+(?:от|для|к|for|de|du|del)[ \\t]+[^:=\\r\\n"\\\\]{1,64})?[ \\t]*([:=：]|(?<![\\p{L}\\p{N}_])(?:${verbs})(?![\\p{L}\\p{N}_]))[ \\t]*`,
  'giu'
);
// Bare generic labels are common English nouns. After a verb they need a
// value that looks generated; "the token is valid" is prose, not a secret.
const genericLabel =
  /^(?:token|sig|sas|secret|auth|authorization|cookie|секрет|токен)$/iu;
function generatedWord(text, range) {
  const word = /^[^\s]+/u
    .exec(text.slice(range.start, range.end))?.[0]
    .replace(/[.,;:!?)]+$/u, '');
  if (
    !word ||
    !(
      (word.length >= 6 && /\p{L}/u.test(word) && /\d/.test(word)) ||
      /^[\w+/=.-]{20,}$/.test(word)
    )
  ) {
    return undefined;
  }
  return { start: range.start, end: range.start + word.length };
}
const ignored =
  /^(?:true|false|null|undefined|await|async|function|none|nil)$/i;
const credentialHint = new RegExp(
  [...labels.credential, 'pass', 'pw'].map(escapePattern).join('|'),
  'iu'
);

function emitValue(text, start, end, emit, details, keyName = '') {
  while (end > start && /[ \t\r]/.test(text[end - 1])) {
    end--;
  }
  const value = text.slice(start, end);
  if (!value || value.startsWith(REDACTED) || ignored.test(value)) {
    return;
  }
  if (details.category === 'credential' && credentialPlaceholder(value)) {
    return;
  }
  if (details.category === 'credential' && credentialMetadata(keyName, value)) {
    return;
  }
  if (
    /tokens$|token(?:count|limit|usage|budget)$|(?:password|passphrase)(?:length|count|size)$/.test(
      keyName.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
    ) &&
    /^\d+(?:\.\d+)?$/.test(value)
  ) {
    return;
  }
  emit({ start, end, ...details });
}

function credentialMetadata(keyName, value) {
  return (
    (/(?:^|[_.-])auth[_.-](?:mode|method|type)$/i.test(keyName) &&
      /^(?:chatgpt|oauth2?|apikey|api_key|bearer|basic|none)$/i.test(value)) ||
    (keyName === 'id-token' && /^(?:write|read|none)$/.test(value)) ||
    // Package/version metadata cannot exempt exact credential labels.
    (!labels.credential.includes(keyName.toLowerCase()) &&
      /^(?:@[a-z0-9_.-]+\/)?[a-z0-9][a-z0-9_.-]*$/.test(keyName) &&
      value.length <= 128 &&
      /^[~^<>=* ]*v?\d+(?:\.[\dx*]+){0,2}(?:-[\w.-]+)?(?:\s*\|\|\s*[~^<>=* ]*v?\d+(?:\.[\dx*]+){0,2}(?:-[\w.-]+)?)*$/i.test(
        value
      ))
  );
}

// Opening quotes support the escape depth of an outer AI-session string.
// Only a quote at the same escape depth closes it; embedded quotes belong to
// the value. Offsets cover escape bytes as well as the decoded characters.
export function valueRange(text, start, mode = 'token', maxLength = Infinity) {
  const reference = referencePrefix(text.slice(start, start + 512));
  if (reference) {
    return { start, end: start + reference[0].length };
  }
  const opening = text.slice(start).match(/^(\\*)(["'])/);
  if (opening) {
    const range = quotedRange(text, start, opening, maxLength);
    const outer = outerQuoteEnd(text, range.start, range.end);
    return outer === undefined ? range : { ...range, end: outer };
  }
  if (/^[{[]/.test(text.slice(start, start + 1))) {
    return undefined;
  }
  const tail = text.slice(start, start + maxLength);
  const terminator =
    mode === 'query'
      ? /[\s&#"'<>]/
      : mode === 'line'
        ? /[\r\n<>"]|\\+[nrt"']/
        : mode === 'prose'
          ? /[\r\n<>]|\\+[nrt"']|(?<![ \t])[ \t]+(?:for the|for my|для|pour|para|für|لـ)(?:[ \t]|$)/iu
          : /[\s,;}\]"'<>]|\\+[nrt"']/;
  const stop = tail.search(terminator);
  const end = stop < 0 ? start + tail.length : start + stop;
  return { start, end: Math.min(end, outerQuoteEnd(text, start, end) ?? end) };
}
// Header credentials occupy a scheme and one token even inside shell/JSON
// strings. A closing quote or escape belongs to the surrounding log record.
export function authorizationRange(text, start) {
  const opening = /^(\\*)(["'])/.exec(text.slice(start));
  start += opening?.[0].length ?? 0;
  const reference = referencePrefix(text.slice(start, start + 512));
  if (reference) {
    return { start, end: start + reference[0].length };
  }
  if (text.startsWith(REDACTED, start)) {
    return undefined;
  }
  const match = /^(?:[a-z][a-z0-9_-]*[ \t]+)?[^\s"'\\,<>}\]]+/i.exec(
    text.slice(start)
  );
  return match ? { start, end: start + match[0].length } : undefined;
}
function quotedRange(text, start, opening, maxLength) {
  const depth = opening[1].length,
    quote = opening[2];
  const valueStart = start + opening[0].length;
  for (
    let i = valueStart;
    i < Math.min(text.length, valueStart + maxLength);
    i++
  ) {
    if (
      Number.isFinite(maxLength) &&
      /^(?:[\r\n]|\\+[nrt])/.test(text.slice(i, i + 8))
    ) {
      return { start: valueStart, end: i };
    }
    if (text[i] !== quote) {
      continue;
    }
    let slashes = 0;
    for (let j = i - 1; j >= valueStart && text[j] === '\\'; j--) {
      slashes++;
    }
    if (slashes === depth) {
      return { start: valueStart, end: i - depth };
    }
    // A containing JSON string can close before an unfinished inner quote.
    if (quote === '"' && slashes < depth && slashes % 2 === 0) {
      return { start: valueStart, end: Math.max(valueStart, i) };
    }
  }
  return {
    start: valueStart,
    end: Math.min(text.length, valueStart + maxLength),
  };
}

function plausibleLabel(value, type) {
  if (type === 'PERSON') {
    return plausiblePerson(value.replace(/[,;\d].*$/s, '').trim());
  }
  if (['STATE', 'US_STATE', 'CITY', 'REGION', 'PROVINCE'].includes(type)) {
    return (
      /^[\p{L}\p{M}][\p{L}\p{M} .’'-]{1,79}$/u.test(value) &&
      (!/\p{Ll}/u.test(value) || /\p{Lu}/u.test(value))
    );
  }
  return true;
}

// Shared by native labels and the vendor catalogs. Code expressions and
// line escapes are not personal field values, even when a key is familiar.
export function personalValueAllowed(text, range, type, labelStart) {
  const value = text.slice(range.start, range.end).trim();
  if (!plausibleLabel(value, type)) {
    return false;
  }
  if (['LOCATION', 'ADDRESS'].includes(type) && servicePath(value)) {
    return false;
  }
  if (type === 'PHONE') {
    return (
      /^\+?[\d () .-]{7,40}$/.test(value) &&
      /\d{3}/.test(value.replace(/\D/g, ''))
    );
  }
  if (type === 'EMAIL') {
    return /^[^\s@]+@[^\s@]+\.[\p{L}]{2,63}$/u.test(value);
  }
  if (/^(?:\\[nrt]|[\r\n])/.test(value)) {
    return false;
  }
  if (
    ['ADDRESS', 'STATE', 'US_STATE', 'CITY', 'REGION', 'PROVINCE'].includes(
      type
    )
  ) {
    if (!/\p{L}{2}|\d{4,}/u.test(value)) {
      return false;
    }
  }
  if (
    ['PERSON', 'USERNAME'].includes(type) &&
    !/["']/.test(text[range.start - 1] ?? '')
  ) {
    const before = text
      .slice(Math.max(0, labelStart - 100), labelStart)
      .split(/[\r\n]/)
      .at(-1);
    if (
      /\b(?:const|let|var)\s+$/.test(before) ||
      /\b[\p{L}_$][\p{L}\p{N}_$]*(?:\s*\(|\.[\p{L}_$])/u.test(value)
    ) {
      return false;
    }
  }
  return true;
}

// Prose labels inside JSON strings stop at the enclosing quote.
function outerQuoteEnd(text, start, end) {
  let opening = start - 1;
  while (opening >= Math.max(0, start - 8192)) {
    opening = text.lastIndexOf('"', opening);
    if (opening < 0) {
      return undefined;
    }
    if (backslashes(text, opening) % 2 === 0) {
      break;
    }
    opening--;
  }
  // Structured batches put each JSON string on its own line, after an
  // optional field prefix; values never continue into the next token.
  if (
    opening < 0 ||
    (opening > 0 &&
      text[opening - 1] !== '\n' &&
      !/:\s*$/.test(text.slice(Math.max(0, opening - 8), opening)))
  ) {
    return undefined;
  }
  for (let i = start; i < end; i++) {
    if (text[i] === '"' && backslashes(text, i) % 2 === 0) {
      return i;
    }
  }
  return undefined;
}
function backslashes(text, index) {
  let count = 0;
  while (index > 0 && text[--index] === '\\') {
    count++;
  }
  return count;
}

function detectCredentials(text, emit) {
  const details = { category: 'credential', type: 'SECRET', rule: 'context' };
  for (const match of text.matchAll(credentialPrefix)) {
    const start = match.index + match[0].length;
    const prefix = text.slice(Math.max(0, match.index - 512), match.index);
    const query =
      /(?:https?:\/\/[^\s]*[?&]|^[?&])[^\s]*$/i.test(prefix) ||
      /[?&]$/.test(prefix);
    const mode = query
      ? 'query'
      : match[2] === '=' || /["']\s*[:：]/.test(match[0])
        ? 'token'
        : /[:：]/.test(match[2])
          ? 'line'
          : 'prose';
    let range = /^(?:proxy-)?authorization$/i.test(match[1])
      ? authorizationRange(text, start)
      : valueRange(text, start, mode);
    if (range && mode === 'prose' && genericLabel.test(match[1])) {
      range = generatedWord(text, range);
    }
    if (range) {
      emitValue(text, range.start, range.end, emit, details, match[1]);
    }
  }
  const xml = new RegExp(`<(${key})[ \\t]*>([^<]+)</\\1[ \\t]*>`, 'giu');
  for (const match of text.matchAll(xml)) {
    const start = match.index + match[0].indexOf('>') + 1;
    emitValue(text, start, start + match[2].length, emit, details, match[1]);
  }
  const flags = new RegExp(`--(${key})(?:[ \\t]+|=)`, 'giu');
  for (const match of text.matchAll(flags)) {
    const range = valueRange(text, match.index + match[0].length);
    if (range) {
      emitValue(text, range.start, range.end, emit, details, match[1]);
    }
  }
}

function detectPersonalLabels(text, emit) {
  for (const [type, words] of Object.entries(labels)) {
    if (type === 'credential') {
      continue;
    }
    const separator =
      type === 'ID'
        ? `(?:[:=：]|(?:${verbs})(?![\\p{L}\\p{N}_]))?[ \\t]+|[:=：][ \\t]*`
        : `(?:[:=：]|(?:${verbs})(?![\\p{L}\\p{N}_]))[ \\t]*`;
    const prefix = new RegExp(
      `(?<![\\p{L}\\p{N}_])(?:\\\\*["'])?(?:${words.map(escapePattern).join('|')})(?![\\p{L}\\p{N}_])(?:\\\\*["'])?[ \\t]*(?:${separator})`,
      'giu'
    );
    for (const match of text.matchAll(prefix)) {
      const identity = type === 'ID';
      const suffix = identity
        ? (/^(?:(?:number|no\.?|номер)[ \t]*[:=：]?[ \t]*|[№#][ \t]*)/iu.exec(
            text.slice(match.index + match[0].length)
          )?.[0] ?? '')
        : '';
      const range = valueRange(
        text,
        match.index + match[0].length + suffix.length,
        identity ? 'token' : 'line',
        512
      );
      if (range && personalValueAllowed(text, range, type, match.index)) {
        if (type === 'PERSON') {
          const delimiter = text.slice(range.start, range.end).search(/[,;\d]/);
          if (delimiter >= 0) {
            range.end = range.start + delimiter;
          }
        }
        emitValue(text, range.start, range.end, emit, {
          type:
            identity &&
            /passport|паспорт|pasaporte|Reisepass|passeport|passaporto|护照|パスポート|جواز/iu.test(
              match[0]
            )
              ? 'PASSPORT_NUMBER'
              : type,
          category: 'personal',
          rule: 'label',
        });
      }
    }
  }
}

function detectCommandPasswords(text, emit) {
  const details = {
    type: 'SECRET',
    category: 'credential',
    rule: 'cli-password',
  };
  // Scope short flags to programs whose documentation assigns that meaning.
  // mysql -P and psql -p are port numbers and deliberately excluded.
  for (const line of text.matchAll(/[^\r\n;|&]+/g)) {
    const command = line[0];
    let flag;
    if (/(?:^|[\s/])(?:mysql|mariadb|sshpass)(?:\s|$)/.test(command)) {
      flag = /(?:^|\s)-p[ \t]*/g;
    } else if (/(?:^|[\s/])(?:7z|7za|unzip)(?:\s|$)/.test(command)) {
      flag = /(?:^|\s)-(?:p|P)[ \t]*/g;
    }
    if (flag) {
      for (const match of command.matchAll(flag)) {
        const range = valueRange(
          text,
          line.index + match.index + match[0].length
        );
        if (range) {
          emitValue(text, range.start, range.end, emit, details);
        }
      }
    }
    if (/(?:^|[\s/])curl(?:\s|$)/.test(command)) {
      for (const match of command.matchAll(
        /(?:^|\s)(?:-u|--user)(?:[ \t]+|=)/g
      )) {
        const range = valueRange(
          text,
          line.index + match.index + match[0].length
        );
        if (range) {
          emitValue(text, range.start, range.end, emit, details);
        }
      }
    }
  }
}

export function detectContext(text, emit, credentialsOnly = false) {
  if (credentialHint.test(text)) {
    detectCredentials(text, emit);
  }
  if (!credentialsOnly) {
    detectPersonalLabels(text, emit);
  }
  detectCommandPasswords(text, emit);
}
