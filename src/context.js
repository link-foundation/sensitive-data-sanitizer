import { labels } from './rules.js';
import { escapePattern, REDACTED } from './detection.js';
import { credentialPlaceholder } from './credentials.js';

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
const credentialPrefix = new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:\\\\*["'])?(${key})(?:\\\\*["'])?(?:[ \\t]+(?:от|для|к|for|de|du|del)[^:=\\r\\n]{1,64})?[ \\t]*([:=：]|(?:${verbs})(?![\\p{L}\\p{N}_]))[ \\t]*`,
  'giu'
);
const ignored =
  /^(?:true|false|null|undefined|await|async|function|none|nil)$/i;

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

// Opening quotes support the escape depth of an outer AI-session string.
// Only a quote at the same escape depth closes it; embedded quotes belong to
// the value. Offsets cover escape bytes as well as the decoded characters.
export function valueRange(text, start, mode = 'token') {
  const opening = text.slice(start).match(/^(\\*)(["'])/);
  if (opening) {
    const depth = opening[1].length,
      quote = opening[2];
    const valueStart = start + opening[0].length;
    for (let i = valueStart; i < text.length; i++) {
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
    }
    return { start: valueStart, end: text.length };
  }
  if (/^[{[]/.test(text.slice(start, start + 1))) {
    return undefined;
  }
  const tail = text.slice(start);
  const terminator =
    mode === 'query'
      ? /[\s&#"'<>]/
      : mode === 'line'
        ? /[\r\n<>]/
        : mode === 'prose'
          ? /[\r\n<>]|(?<![ \t])[ \t]+(?:for the|for my|для|pour|para|für|لـ)(?:[ \t]|$)/iu
          : /[\s,;}\]"'<>]/;
  const stop = tail.search(terminator);
  const end = stop < 0 ? text.length : start + stop;
  return { start, end: Math.min(end, outerQuoteEnd(text, start) ?? end) };
}

// Prose labels inside JSON strings stop at the enclosing quote.
function outerQuoteEnd(text, start) {
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
  if (
    opening < 0 ||
    !/:\s*$/.test(text.slice(Math.max(0, opening - 8), opening))
  ) {
    return undefined;
  }
  for (let i = start; i < text.length; i++) {
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
    const range = valueRange(text, start, mode);
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
        identity ? 'token' : 'line'
      );
      if (range) {
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

export function detectContext(text, emit) {
  detectCredentials(text, emit);
  detectPersonalLabels(text, emit);
  detectCommandPasswords(text, emit);
}
