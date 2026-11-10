// Builds case inputs whose provider-shaped tokens were stored as {{TOKEN}}
// templates, so that no credential-shaped literal is committed to the repo
// (Secretlint and GitHub push protection scan every file).
import { crc32 } from 'node:zlib';

const alnum = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const sets = {
  alnum,
  url: `${alnum}_-`,
  under: `${alnum}_`,
  hex: '0123456789abcdef',
  digits: '0123456789',
  b64: `${alnum}+/`,
  bech32: 'QPZRY9X8GF2TVDW0S3JN54KHCE6MUA7L',
  tilde: `${alnum}_~.-`,
};
// Deterministic xorshift so every probe run sees the same fakes.
function random(seed) {
  let state = seed >>> 0 || 1;
  return (set, length) =>
    Array.from({ length }, () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return set[(state >>> 0) % set.length];
    }).join('');
}
function charset(spec = '') {
  if (/bech32/.test(spec)) {
    return sets.bech32;
  }
  if (/base64|\/\+/.test(spec)) {
    return sets.b64;
  }
  if (/x \(mask\)/.test(spec)) {
    return 'x';
  }
  if (/_-/.test(spec)) {
    return sets.url;
  }
  if (/_\]/.test(spec)) {
    return sets.under;
  }
  return sets.alnum;
}
const digits = '0123456789';
const b62 = `${digits}ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`;
function crcBase62(body) {
  let out = '';
  for (let n = crc32(body); n > 0; n = Math.floor(n / 62)) {
    out = b62[n % 62] + out;
  }
  return out.padStart(6, '0');
}
const b64url = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
function shaped(template, take) {
  const shape = template.shape ?? '';
  if (/digits-digits-digits-hex/.test(shape)) {
    return `${template.prefix}${take(sets.digits, 12)}-${take(sets.digits, 12)}-${take(sets.digits, 13)}-${take(sets.hex, 32)}`;
  }
  if (/^SG\./.test(shape)) {
    return `SG.${take(sets.url, 22)}.${take(sets.url, 43)}`;
  }
  if (/-us<1-2 digits>/.test(shape)) {
    return `${take(sets.hex, 32)}-us${take(sets.digits, 2)}`;
  }
  if (/atlasv1/.test(shape)) {
    return `${take(sets.alnum, 14)}.atlasv1.${take(sets.url, 67)}`;
  }
  if (/Q~/.test(shape)) {
    return `${take(sets.alnum, 3)}${take(sets.digits, 1)}Q~${take(sets.tilde, 34)}`;
  }
  if (/base64url header/.test(shape)) {
    return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: take(sets.digits, 10) })}.${take(sets.url, 43)}`;
  }
  return undefined;
}
// Returns the token for a case template, or undefined when unsupported.
export function templateToken(template, seed = 1) {
  if (!template) {
    return undefined;
  }
  if (template.fill) {
    return template.fill['{{TOKEN}}'];
  }
  const take = random(seed);
  const shape = shaped(template, take);
  if (shape) {
    return shape;
  }
  if (!template.length) {
    return undefined;
  }
  const prefix = template.prefix ?? '';
  if (/crc32-base62/.test(template.checksum ?? '')) {
    const body = take(sets.alnum, template.length - 6);
    return `${prefix}${body}${crcBase62(`${prefix}${body}`)}`;
  }
  return `${prefix}${take(charset(template.charset), template.length)}${template.suffix ?? ''}`;
}
export function fillCase(entry, seed) {
  if (!entry.input?.includes('{{')) {
    return entry;
  }
  const token = templateToken(entry.template, seed);
  if (token === undefined) {
    return undefined;
  }
  const fill = (s) => s.replaceAll('{{TOKEN}}', token);
  return {
    ...entry,
    input: fill(entry.input),
    sensitive: (entry.sensitive ?? []).map(fill),
  };
}
