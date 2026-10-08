import { collectMatches } from './detection.js';

export function credentialPlaceholder(value) {
  return /^(?:\$\{[A-Za-z_][A-Za-z0-9_]*\}|\$[A-Za-z_][A-Za-z0-9_]*|<[^<>]+>|\[REDACTED\])$/.test(
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
    /(?<![\w])(?:machine[ \t]+[^\s"'<>]+|default)\s+login\s+[^\s"'<>]+\s+password\s+(?:"[^"\r\n]+"|'[^'\r\n]+'|[^\s"'<>]+)/g,
    emit,
    details('netrc'),
    0,
    (value) => {
      const password = value
        .match(/\bpassword\s+(.+)$/s)?.[1]
        ?.replace(/^["']|["']$/g, '');
      return password && !credentialPlaceholder(password);
    }
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
  collectMatches(
    text,
    /PuTTY-User-Key-File-[23]:[^\r\n]*(?:\r\n|\r|\n)[\s\S]*?(?:Private-MAC:[ \t]*[a-fA-F0-9]+|$)/g,
    emit,
    details('putty-private-key')
  );
}
