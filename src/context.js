import { labels } from './rules.js';
import { escapePattern, REDACTED } from './detection.js';
import { credentialPlaceholder, referencePrefix } from './credentials.js';
import { servicePath } from './public.js';
import { cookieValues } from './credential-spans.js';
import { plausiblePerson } from './names.js';
import { htmlTag } from './html-tags.js';

// Bounded vocabularies are explicit so the short PASS/PW forms do not match
// unrelated words such as passport. Verb forms cover the supported locales.
export const credentialVerbs = [
  'is',
  'are',
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
const label = labels.credential
  .filter((word) => !['auth', 'authorization'].includes(word))
  .map(escapePattern)
  .join('|');
// Glued service prefixes (`dbpass`, `rootpassword`, `bindpw`, `tlspassword`)
// are fixed so that ordinary words ending in "pass" stay prose.
const glued =
  '(?:db|user|root|admin|smtp|mail|ftp|sftp|ssh|redis|ldap|bind|proxy|tls|ssl|keystore|truststore|store|master|sys|app|login|account|acct|wifi|wpa)(?:password|passwd|pass|pwd|pw|secret|token)';
// Plural credential names (`--access-tokens`, `API_KEYS`) hold credentials;
// other plurals (`--max-tokens`, `tokens: 1234`) are accounting.
const plural =
  '(?:access|refresh|auth|session|api|bearer|client)[_.-]?(?:tokens|keys|secrets)';
const key = `(?:[\\p{L}\\p{N}]+[_.-])*(?:auth|authorization|PGPASSWORD|${glued}|${plural}|${label}|pass|pw)(?:[_.-][\\p{L}\\p{N}]+)*`;
// Ruby/Perl/PHP hash rockets (`'password' => 'x'`, `:token => "x"`) take a
// quoted literal; an arrow function (`token => token.trim()`) does not.
const rocket = `=>(?=[ \\t]*\\\\*["'])`;
// A qualifier such as "for staging" stays on one logical line: it never
// crosses an escaped line break, an escape sequence or an enclosing quote.
// Verbs are whole words, so "request" does not end in the verb "est".
const credentialPrefix = new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:\\\\*["'])?(${key})(?![\\p{L}\\p{N}_])(?:\\\\*["'])?(?:[ \\t]+(?:от|для|к|for|de|du|del)[ \\t]+[^:=\\r\\n"\\\\]{1,64})?[ \\t]*(${rocket}|[:=：]|(?<![\\p{L}\\p{N}_])(?:${verbs})(?![\\p{L}\\p{N}_]))[ \\t]*`,
  'giu'
);
// camelCase and PascalCase keys (`clientSecret`, `secretKey`, `dbPassword`,
// `ApiSecret`) are case-sensitive: the credential word starts a new word, so
// `tokenType`, `secretName` and `maxTokens` stay configuration metadata.
const camelKey =
  '[\\p{L}][\\p{Ll}\\p{N}]*(?:\\p{Lu}[\\p{Ll}\\p{N}]*)*?(?:Secret|Password|Passwd|Passphrase|Pass|Pwd|Token|Credentials?|(?:Api|Private|Access|Secret|Signing|Encryption|Master|Client|App|Subscription|Account|Storage)Key)(?:Key|Value)?|(?:[Ss]ecret|[Pp]assword|[Pp]asswd|[Tt]oken|[Pp]rivate|[Aa]ccess|[Ss]igning|[Ee]ncryption)(?:Key|Value|Secret|Token)';
const camelPrefix = new RegExp(
  `(?<![\\p{L}\\p{N}_$])(?:\\\\*["'])?(${camelKey})(?![\\p{L}\\p{N}_])(?:\\\\*["'])?[ \\t]*(${rocket}|[:=])[ \\t]*`,
  'gu'
);
// Bare generic labels are common English nouns. After a verb they need a
// value that looks generated; "the token is valid" is prose, not a secret.
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

// `HIVE_MIND_ROUTER_AUTH_GUARD=0`, `GIT_AUTH_TRANSPORT=1`, `AUTH_MODE=2`:
// a number or a boolean under a configuration name is a setting. Credential
// names (`AUTH_TOKEN=123456`, `AUTH_PASSWORD=1`) do not end in one of these.
const configurationSuffix =
  /[_.-](?:guard|transport|mode|method|type|kind|flow|strategy|scheme|protocol|port|level|state|status|enabled?|disabled?|required|strict|debug|verbose|timeout|ttl|interval|retries|retry|attempts|count|limit|max|min|size|length|version|flag)$/i;
const configurationValue =
  /^(?:[+-]?\d{1,9}(?:\.\d+)?|true|false|yes|no|on|off|enabled|disabled|none)$/i;
export function configurationSetting(keyName, value) {
  return configurationSuffix.test(keyName) && configurationValue.test(value);
}

function credentialMetadata(keyName, value) {
  return (
    configurationSetting(keyName, value) ||
    // This documented opt-out enum is public; other authority values and
    // names still carry credential evidence.
    (keyName === 'HIVE_MIND_CLAUDE_AUTH_AUTHORITY' &&
      value === 'conventional') ||
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
  const reference = referencePrefix(
    text.slice(start, markdownEnd(text, start, 512))
  );
  if (reference) {
    return { start, end: start + reference[0].length };
  }
  const opening = text.slice(start).match(/^(\\*)(["']|`+)/);
  if (opening) {
    const range = quotedRange(text, start, opening, maxLength);
    const outer = outerQuoteEnd(text, range.start, range.end);
    return outer === undefined ? range : { ...range, end: outer };
  }
  if (/^[{[]/.test(text.slice(start, start + 1))) {
    return undefined;
  }
  const tail = text.slice(start, markdownEnd(text, start, maxLength));
  // Only a matching surrounding Markdown delimiter ends an unquoted value.
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
// The scheme (`token`, `Bearer`, `Digest`) stays readable; only the
// credential is returned. Auth-param lists (`Digest username="a", nonce=…`,
// AWS SigV4) return each secret parameter value.
export function authorizationRanges(text, start) {
  const opening = /^(\\*)(["'])/.exec(text.slice(start));
  start += opening?.[0].length ?? 0;
  const reference = referencePrefix(text.slice(start, start + 512));
  if (reference) {
    return [{ start, end: start + reference[0].length }];
  }
  const scheme = /^[a-z][a-z0-9_-]*[ \t]+/i.exec(text.slice(start));
  const tokenStart = start + (scheme?.[0].length ?? 0);
  const params = scheme ? authParams(text, tokenStart) : undefined;
  if (params) {
    return params;
  }
  const end = authorizationEnd(text, tokenStart);
  const token = text.slice(tokenStart, end);
  return usableAuthorization(token) ? [{ start: tokenStart, end }] : [];
}
function authorizationEnd(text, tokenStart) {
  const brackets = [];
  let end = tokenStart;
  for (; end < text.length; end++) {
    const char = text[end];
    const code = text.charCodeAt(end);
    if (authorizationDelimiter(char, code)) {
      break;
    }
    if (char === '<' && end !== tokenStart && !brackets.length) {
      break;
    }
    const closing = { '{': '}', '[': ']', '<': '>' }[char];
    if (closing) {
      brackets.push(closing);
    } else if (/[}\]>]/.test(char) && char !== brackets.pop()) {
      // An unmatched closer belongs to the enclosing log structure.
      break;
    }
  }
  return end;
}

// RFC 7616/7235 parameters that name the request, not a secret.
const publicAuthParam =
  /^(?:username|realm|uri|qop|algorithm|nc|charset|userhash|domain|stale|SignedHeaders|oauth_signature_method|oauth_version|oauth_timestamp|oauth_callback|keyId|headers|created|expires)$/i;
const authParam = /^([A-Za-z][\w-]*)[ \t]*=[ \t]*/;
function authParams(text, start) {
  const ranges = [];
  let cursor = start,
    count = 0,
    quoted = false;
  for (;;) {
    const name = authParam.exec(text.slice(cursor, cursor + 128));
    if (!name) {
      break;
    }
    const valueStart = cursor + name[0].length;
    const value = authParamValue(text, valueStart);
    if (!value) {
      break;
    }
    count++;
    quoted ||= value.quoted;
    if (!publicAuthParam.test(name[1]) && value.end > value.start) {
      ranges.push({ start: value.start, end: value.end });
    }
    const separator = /^[ \t]*,[ \t]*/.exec(
      text.slice(value.after, value.after + 64)
    );
    if (!separator) {
      break;
    }
    cursor = value.after + separator[0].length;
  }
  // `Basic dXNlcg==` is one token68 credential, not a parameter list.
  return count > 1 || (count === 1 && quoted) ? ranges : undefined;
}
function authParamValue(text, start) {
  const quote = /^(\\*)"/.exec(text.slice(start, start + 64));
  if (quote) {
    // Parameter values are short; a quote further away is not their end.
    const window = text.slice(start, start + 4096);
    const offset = window.indexOf(quote[0], quote[0].length);
    const close = start + offset;
    if (offset < 0 || /[\r\n]/.test(window.slice(0, offset))) {
      return undefined;
    }
    const after = close + quote[0].length;
    // A quoted value ends the header or continues the list.
    if (
      !/^(?:[ \t]*(?:,|$|[\r\n])|\\*["'\r\n])/.test(
        text.slice(after, after + 64)
      )
    ) {
      return undefined;
    }
    return { start: start + quote[0].length, end: close, after, quoted: true };
  }
  const token = /^[^\s,"'\\]{1,4096}/.exec(text.slice(start, start + 4096));
  return token
    ? { start, end: start + token[0].length, after: start + token[0].length }
    : undefined;
}
function usableAuthorization(token) {
  return Boolean(token) && !credentialPlaceholder(token);
}
function authorizationDelimiter(char, code) {
  return code < 32 || code === 127 || /[\s"'\\,]/.test(char);
}
function quotedRange(text, start, opening, maxLength) {
  const depth = opening[1].length,
    quote = opening[2];
  const valueStart = start + opening[0].length;
  if (quote[0] === '`') {
    return markdownRange(text, valueStart, quote.length, maxLength);
  }
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

// Markdown closes only at a run of the same length. Scan each run once so
// long unmatched backtick runs cannot cause repeated prefix comparisons.
function markdownRange(text, start, length, maxLength) {
  const limit = Math.min(text.length, start + maxLength);
  for (let i = start; i < limit; i++) {
    if (text[i] !== '`') {
      continue;
    }
    let end = i + 1;
    while (end < limit && text[end] === '`') {
      end++;
    }
    if (end - i === length && text[end] !== '`') {
      return { start, end: i };
    }
    i = end - 1;
  }
  return { start, end: limit };
}

// Recognize surrounding inline Markdown within a bounded logical line. When
// its opening or closing delimiter cannot be established, keep scanning the
// full credential, including any literal material following a placeholder.
function markdownEnd(text, start, maxLength) {
  const end = Math.min(text.length, start + maxLength);
  const from = Math.max(0, start - 4096);
  const prefix = text.slice(from, start);
  const lineStart =
    Math.max(prefix.lastIndexOf('\n'), prefix.lastIndexOf('\r')) + 1;
  if (from && !lineStart) {
    return end;
  }
  let length = 0;
  for (const run of prefix.slice(lineStart).matchAll(/`+/g)) {
    if (!length) {
      let slashes = 0;
      for (
        let i = lineStart + run.index - 1;
        i >= 0 && prefix[i] === '\\';
        i--
      ) {
        slashes++;
      }
      if (slashes % 2 === 0) {
        length = run[0].length;
      }
    } else if (length === run[0].length) {
      length = 0;
    }
  }
  if (!length) {
    return end;
  }
  const limit = Math.min(end, start + 4096);
  const close = markdownRange(text, start, length, limit - start).end;
  return close < limit ? close : end;
}

function plausibleLabel(value, type) {
  if (operationalValue(value, type)) {
    return false;
  }
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

function operationalValue(value, type) {
  return (
    (type === 'URL' &&
      /^\/(?!\/)[^\s?@#]*$/.test(value) &&
      !/(?:^|\/)(?:u|in|users?|profiles?|people|members?|home)\/[^/]+/i.test(
        value
      )) ||
    (type === 'TIME' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value
      ))
  );
}

function operationalLocationPath(value) {
  return (
    servicePath(value) || /^(?:\.?\.?\/)?[\w.-]+(?:\/[\w.-]+)+\/?$/.test(value)
  );
}
// Types with a fixed value shape decide on the value alone; `undefined` leaves
// the decision to the general checks.
function shapedValueAllowed(value, type) {
  if (type === 'PHONE') {
    return (
      /^\+?[\d () .-]{7,40}$/.test(value) &&
      /\d{3}/.test(value.replace(/\D/g, ''))
    );
  }
  if (type === 'EMAIL') {
    return /^[^\s@]+@[^\s@]+\.[\p{L}]{2,63}$/u.test(value);
  }
  // A URL holds no whitespace, so prose under a `url` key is left to the
  // detectors of what the prose contains.
  if (type === 'URL' && /\s/u.test(value)) {
    return false;
  }
  return undefined;
}
// Shared by native labels and the vendor catalogs. Code expressions and
// line escapes are not personal field values, even when a key is familiar.
export function personalValueAllowed(text, range, type, labelStart) {
  const value = text.slice(range.start, range.end).trim();
  if (!plausibleLabel(value, type)) {
    return false;
  }
  if (
    ['LOCATION', 'ADDRESS'].includes(type) &&
    operationalLocationPath(value)
  ) {
    return false;
  }
  const shaped = shapedValueAllowed(value, type);
  if (shaped !== undefined) {
    return shaped;
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

function sourceReference(label, tail) {
  return (
    /\.(?:[cm]?[jt]sx?|py|go|rs|c|cpp|h|java|cs|rb|sh)$/iu.test(label) &&
    /^\d+(?:[):]|\b)/u.test(tail)
  );
}

// A camelCase key is usually source code; an unquoted member chain, call or
// type annotation after it (`config.clientSecret`, `apiToken: string;`) is
// a reference, not the secret itself.
function codeValue(text, start) {
  return /^(?:[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)+(?:\([^()\r\n]*\))?|[A-Za-z_$][\w$]*\([^()\r\n]*\)|(?:string|number|boolean|any|unknown|str|bytes|String|SecretStr|Optional\[str\])(?![\w$]))[ \t]*(?:[,;)}\]]|\r?\n|$)/u.test(
    text.slice(start, start + 256)
  );
}

// Picks how far a credential value runs: to the end of a query parameter, a
// token, a line or a prose word.
function credentialMode(text, match) {
  const prefix = text.slice(Math.max(0, match.index - 512), match.index);
  if (
    /(?:https?:\/\/[^\s]*[?&]|^[?&])[^\s]*$/i.test(prefix) ||
    /[?&]$/.test(prefix)
  ) {
    return 'query';
  }
  if (/^=>?$/.test(match[2]) || /["']\s*[:：]/.test(match[0])) {
    return 'token';
  }
  return /[:：]/.test(match[2]) ? 'line' : 'prose';
}

// `token: <script>alert(1)</script>`: markup is the value. A bare
// `<placeholder>` that ends the value stays a placeholder.
const angleEnd = {
  line: /[\r\n"]|\\+[nrt"']/,
  token: /[\s,;}\]"']|\\+[nrt"']/,
};
// Formatting tags around a value (`token=<em>…</em>`) are dropped from the
// detection view instead.
const formattingTag = new RegExp(`^${htmlTag}`, 'i');
function angleValue(text, start, mode) {
  if (text[start] !== '<' || !angleEnd[mode]) {
    return undefined;
  }
  const tail = text.slice(start, markdownEnd(text, start, 4096));
  if (formattingTag.test(tail)) {
    return undefined;
  }
  const placeholder = /^<[^<>\r\n]{1,64}>/.exec(tail)?.[0];
  if (
    placeholder &&
    credentialPlaceholder(placeholder) &&
    angleEnd[mode].test(tail[placeholder.length] ?? '\n')
  ) {
    return { start, end: start + placeholder.length };
  }
  const stop = tail.search(angleEnd[mode]);
  return { start, end: start + (stop < 0 ? tail.length : stop) };
}

// Scheme-prefixed values carry the credential after the keyword, just as
// Authorization headers do. Never mask only `token` and leave its value.
function credentialValueRange(text, start, mode) {
  const valueStart = start;
  if (mode === 'token') {
    start +=
      /^(?:token|Bearer|Basic)[ \t]+(?=\S)/i.exec(text.slice(start))?.[0]
        .length ?? 0;
  }
  const range = angleValue(text, start, mode) ?? valueRange(text, start, mode);
  // Keep the prefix in the value used for metadata checks: `token 0` is not
  // the exact public setting `0`, even under a configuration name.
  return range && start !== valueStart
    ? { ...range, start: valueStart }
    : range;
}

function credentialRange(text, match, camel) {
  const start = match.index + match[0].length;
  if (
    sourceReference(match[1], text.slice(start)) ||
    (camel && codeValue(text, start))
  ) {
    return undefined;
  }
  if (/^(?:proxy-)?authorization$/i.test(match[1])) {
    return authorizationRanges(text, start);
  }
  const mode = credentialMode(text, match);
  const range = credentialValueRange(text, start, mode);
  const value = range && mode === 'prose' ? generatedWord(text, range) : range;
  if (value && /^(?:set-)?cookie$/i.test(match[1])) {
    return cookieValues(text, value.start, value.end);
  }
  return [value].filter(Boolean);
}

// `<password>…</password>`, `<clientSecret attr="1">…</clientSecret>`:
// attributes in the opening tag stay readable.
const element = (name) =>
  `<(${name})(?:[ \\t\\r\\n]+[^<>]{0,512})?>([^<]+)</\\1[ \\t]*>`;
const xmlElement = new RegExp(element(key), 'giu');
const camelElement = new RegExp(element(camelKey), 'gu');

function detectCredentials(text, emit) {
  const details = { category: 'credential', type: 'SECRET', rule: 'context' };
  const matches = [
    ...[...text.matchAll(credentialPrefix)].map((match) => [match, false]),
    ...[...text.matchAll(camelPrefix)].map((match) => [match, true]),
  ];
  for (const [match, camel] of matches) {
    // `https://x-access-token:…@host` is URL user info (`url-userinfo`).
    if (/:\/\/$/.test(text.slice(Math.max(0, match.index - 3), match.index))) {
      continue;
    }
    for (const value of credentialRange(text, match, camel) ?? []) {
      emitValue(text, value.start, value.end, emit, details, match[1]);
    }
  }
  for (const match of [
    ...text.matchAll(xmlElement),
    ...text.matchAll(camelElement),
  ]) {
    const start = match.index + match[0].indexOf('>') + 1;
    emitValue(text, start, start + match[2].length, emit, details, match[1]);
  }
  const flags = new RegExp(`--(${key})(?:[ \\t]+|=)`, 'giu');
  for (const match of text.matchAll(flags)) {
    const start = match.index + match[0].length;
    const range = credentialValueRange(text, start, 'token');
    if (range) {
      emitValue(text, range.start, range.end, emit, details, match[1]);
    }
  }
}

const personalPrefixes = Object.entries(labels)
  .filter(([type]) => type !== 'credential')
  .map(([type, words]) => {
    const separator =
      type === 'ID'
        ? `(?:[:=：]|(?:${verbs})(?![\\p{L}\\p{N}_]))?[ \\t]+|[:=：][ \\t]*`
        : `(?:[:=：]|(?:${verbs})(?![\\p{L}\\p{N}_]))[ \\t]*`;
    return [
      type,
      new RegExp(
        `(?<![\\p{L}\\p{N}_])(?:\\\\*["'])?(?:${words.map(escapePattern).join('|')})(?![\\p{L}\\p{N}_])(?:\\\\*["'])?[ \\t]*(?:${separator})`,
        'giu'
      ),
    ];
  });

// "passport number is 912803456": the number word and a following linking
// verb belong to the label, never to the identity value.
const identitySuffix = new RegExp(
  `^(?:(?:number|no\\.?|номер)[ \\t]*(?:[:=：]|(?:${verbs})(?![\\p{L}\\p{N}_]))?[ \\t]*|[№#][ \\t]*)`,
  'iu'
);

function detectPersonalLabels(text, emit) {
  for (const [type, prefix] of personalPrefixes) {
    for (const match of text.matchAll(prefix)) {
      const identity = type === 'ID';
      const suffix = identity
        ? (identitySuffix.exec(
            text.slice(match.index + match[0].length)
          )?.[0] ?? '')
        : '';
      const range = valueRange(
        text,
        match.index + match[0].length + suffix.length,
        /[?&]$/.test(text.slice(0, match.index))
          ? 'query'
          : identity
            ? 'token'
            : 'line',
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
        /(?:^|\s)(?:-u|--user|-U|--proxy-user)(?:[ \t]+|=)/g
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

// Kubernetes/compose environment entries name the secret in one field and
// carry it in the next: `{"name":"DB_PASSWORD","value":"hunter2"}` or
// `- name: DB_PASSWORD` followed by `value: hunter2`.
const namedValue = new RegExp(
  `(["']?)name\\1[ \\t]*:[ \\t]*(["']?)(${key})\\2[ \\t]*,?[ \\t]*(?:\\r?\\n[ \\t]*)?(["']?)value\\4[ \\t]*:[ \\t]*`,
  'giu'
);
// `smtp.login(user, "hunter2")`, `ftp.login('anna', 'pw')`: a literal second
// argument of a login call is the password.
const loginCall =
  /(?<![\p{L}\p{N}_])(?:login|log_in|logIn|signin|sign_in|signIn|authenticate|auth_login|bind_s|simple_bind_s|connect_with_password)[ \t]*\([ \t]*[^,()\r\n]{1,64},[ \t]*(["'])([^"'\\\r\n]{4,128})\1[ \t]*[,)]/gu;
// Modular crypt and Argon2 password hashes (`$2y$10$…`, `$apr1$…`, `$6$…`)
// from htpasswd, shadow files and user tables crack offline.
const passwordHash =
  /(?<![\p{L}\p{N}_$])\$(?:2[abxy]?\$\d{2}\$[./A-Za-z0-9]{53}|apr1\$[./A-Za-z0-9]{1,8}\$[./A-Za-z0-9]{22}|1\$[./A-Za-z0-9]{1,8}\$[./A-Za-z0-9]{22}|[56]\$(?:rounds=\d{1,9}\$)?[./A-Za-z0-9]{1,16}\$[./A-Za-z0-9]{43,86}|y\$[./A-Za-z0-9]+\$[./A-Za-z0-9]{1,64}\$[./A-Za-z0-9]{43}|argon2(?:id|i|d)\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]{11,}\$[A-Za-z0-9+/]{16,})(?![./A-Za-z0-9$])/gu;
function detectCredentialForms(text, emit) {
  const details = { category: 'credential', type: 'SECRET' };
  if (/name/i.test(text)) {
    for (const match of text.matchAll(namedValue)) {
      const range = valueRange(text, match.index + match[0].length);
      if (range) {
        emitValue(
          text,
          range.start,
          range.end,
          emit,
          { ...details, rule: 'named-value' },
          match[3]
        );
      }
    }
  }
  for (const match of text.matchAll(loginCall)) {
    const start = match.index + match[0].lastIndexOf(match[2]);
    emitValue(text, start, start + match[2].length, emit, {
      ...details,
      rule: 'login-call',
      confidence: 0.85,
    });
  }
  if (text.includes('$')) {
    for (const match of text.matchAll(passwordHash)) {
      emitValue(text, match.index, match.index + match[0].length, emit, {
        ...details,
        rule: 'password-hash',
        confidence: 0.95,
      });
    }
  }
}

export function detectContext(text, emit, credentialsOnly = false) {
  if (credentialHint.test(text)) {
    detectCredentials(text, emit);
  }
  detectCredentialForms(text, emit);
  if (!credentialsOnly) {
    detectPersonalLabels(text, emit);
  }
  detectCommandPasswords(text, emit);
}
