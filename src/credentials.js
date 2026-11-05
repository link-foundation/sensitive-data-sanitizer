import { collectMatches } from './detection.js';

export function credentialPlaceholder(value) {
  return (
    /^(?:\$\{[A-Za-z_][A-Za-z0-9_]*\}|\$[A-Za-z_][A-Za-z0-9_]*|<[^<>]+>|\[REDACTED\])$/.test(
      value
    ) || referencePrefix(value)?.[0] === value
  );
}
// Only variable references and the documented gh lookup are exempt. Arbitrary
// shell commands and Actions expressions can contain literal credentials.
export function referencePrefix(value) {
  return /^(?:(?:token|Bearer|Basic)\s+)?(?:\$\{\{\s*(?:secrets|env|vars|github|inputs)\.[A-Za-z_][A-Za-z0-9_.]*\s*\}\}|\$\(gh\s+auth\s+token(?:\s+--hostname\s+[a-z0-9.-]+)?\))(?=$|[\s"',;\\])/i.exec(
    value
  );
}
const details = (rule) => ({
  type: 'SECRET',
  category: 'credential',
  rule,
  confidence: 0.99,
});
export function detectCredentialFormats(text, emit) {
  collectMatches(
    text,
    /(?<![\w])(?:machine[ \t]+[^\s"'<>]+|default)\s+login\s+[^\s"'<>]+\s+password\s+("[^"\r\n]+"|'[^'\r\n]+'|[^\s"'<>]+)/g,
    emit,
    details('netrc'),
    0,
    (_value, match) =>
      !credentialPlaceholder(match[1].replace(/^["']|["']$/g, ''))
  );
  collectMatches(
    text,
    /(?<![a-z0-9_])oy2[a-z0-9]{43}(?![a-z0-9_])/g,
    emit,
    details('nuget')
  );
  collectMatches(
    text,
    /\bdefine\s*\(\s*(['"])(?:AUTH|SECURE_AUTH|LOGGED_IN|NONCE)_(?:KEY|SALT)\1\s*,\s*(['"])((?:\\.|(?!\2)[^\\\r\n])+)\2\s*\)/g,
    emit,
    details('wordpress'),
    3,
    (value) =>
      !credentialPlaceholder(value) && value !== 'put your unique phrase here'
  );
  detectPuttyPrivateKeys(text, emit);
}

// Scan each consumed range once. A regex combining an unbounded header line
// and a lazy body rescans every repeated header when the newline is missing.
function detectPuttyPrivateKeys(text, emit) {
  const headers = /PuTTY-User-Key-File-[23]:/g;
  const lineEnd = /[\r\n]/g;
  const mac = /Private-MAC:[ \t]*[a-fA-F0-9]+/g;
  let header;
  while ((header = headers.exec(text))) {
    lineEnd.lastIndex = headers.lastIndex;
    const newline = lineEnd.exec(text);
    if (!newline) {
      break;
    }
    mac.lastIndex = newline.index + 1;
    const terminator = mac.exec(text);
    const end = terminator ? mac.lastIndex : text.length;
    emit({ start: header.index, end, ...details('putty-private-key') });
    headers.lastIndex = end;
  }
}
