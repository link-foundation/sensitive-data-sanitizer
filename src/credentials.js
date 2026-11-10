import { collectMatches } from './detection.js';
import { Buffer } from 'node:buffer';

// Re-encoded Hive output can be shorter than the general decoder threshold.
// Recognize only a whole canonical base64/base64url spelling of a complete
// mask; arbitrary decodable text and masks glued to literal text stay sensitive.
function encodedMask(value) {
  if (
    value.length > 64 ||
    !/^(?:[A-Za-z0-9+/]+|[A-Za-z0-9_-]+)={0,2}$/.test(value)
  ) {
    return false;
  }
  const bytes = Buffer.from(value, 'base64url');
  const canonical = bytes.toString('base64');
  const standard = value.replaceAll('-', '+').replaceAll('_', '/');
  const decoded = bytes.toString('utf8');
  return (
    (standard === canonical || standard === canonical.replace(/=+$/, '')) &&
    Buffer.from(decoded).equals(bytes) &&
    /^(?:\[REDACTED\]|[^\s…]{0,3}…[^\s…]{0,3})$/u.test(decoded)
  );
}

export function credentialPlaceholder(value) {
  return (
    /^(?:\$\{[A-Za-z_][A-Za-z0-9_]*\}|\$[A-Za-z_][A-Za-z0-9_]*|<[^<>]+>|\[REDACTED\])$/.test(
      value
    ) || referencePrefix(value)?.[0] === value
  );
}
// One template or mask token: ${NAME}, $${NAME}, $NAME, $1, <name>, [NAME],
// ****, XXXX or an ellipsis. Values made only of these (optionally split by
// a user:password colon) carry no credential material.
// `hive-mask` and `mask` output (`ghp…b4N`, `ab***yz`; NFKC projection turns
// `…` into `...`) keeps at most a few characters around the marker, so a
// second pass leaves it unchanged.
const templateToken =
  /^(?:\$?\$\{[A-Za-z_][\w.-]*\}|\$[A-Za-z_]\w*|\$\d|<[^<>\r\n]{1,64}>|\[[A-Z][A-Z0-9_ ]{0,63}\]|[^\s…*.]{0,4}(?:…|\.{3}|\*{3,})[^\s…*.]{0,4}|[xX]{4,})$/u;
// A whole value that is already a template, a mask or `[REDACTED]`.
export function maskedValue(value) {
  return credentialPlaceholder(value) || templateToken.test(value);
}
const unquote = (part) => part.replace(/^["']|["']$/g, '');

function templatedValue(value) {
  const body = value.replace(/^(?:token|Bearer|Basic)\s+/i, '');
  const colon = body.indexOf(':');
  const parts = (
    colon < 0 ? [body] : [body.slice(0, colon), body.slice(colon + 1)]
  ).map((part) => unquote(part.trim()));
  return (
    parts.some(Boolean) &&
    parts.every((part) => !part || templateToken.test(part))
  );
}

// Detectors stop at whitespace or brackets, so `<API token>` or `[PASSWORD]`
// can arrive truncated; complete them from the following text first.
export function templatedCredential(text, finding) {
  if (finding.category !== 'credential' || finding.rule === 'known-secret') {
    return false;
  }
  let value = text.slice(finding.start, finding.end);
  const closer =
    value.lastIndexOf('<') > value.lastIndexOf('>')
      ? '>'
      : value.lastIndexOf('[') > value.lastIndexOf(']')
        ? ']'
        : '';
  if (closer) {
    const rest = text.slice(finding.end, finding.end + 64);
    const index = rest.indexOf(closer);
    if (index < 0 || /[\r\n]/.test(rest.slice(0, index))) {
      return false;
    }
    value += rest.slice(0, index + 1);
  }
  // A template glued to literal characters (`<x>abc`, `[A]x9`) is not one.
  const after = text[finding.start + value.length] ?? '';
  const sentenceEnd = /^[.,;:!?]+(?:\s|$)/.test(
    text.slice(finding.start + value.length)
  );
  return (
    (!/[\w$%+/=.-]/.test(after) || sentenceEnd) &&
    (templatedValue(value) || encodedMask(value))
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
