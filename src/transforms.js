import { realisticFake } from './fake.js';
import { createHmac } from 'node:crypto';
import { failure, REDACTED } from './detection.js';
import { encodedValue, encodeRun, decodedRuns } from './encoded.js';
import { isIdentityType } from './identity.js';
import { validatePlaceholder, placeholderReplacement } from './placeholders.js';
import { projectText } from './projection.js';
import { encryptValue } from './encrypt.js';

const modes = new Set([
  'redact',
  'fake',
  'hive-mask',
  'mask',
  'pseudonym',
  'format-preserving',
  'date-shift',
  'bucket',
  'placeholder',
  'encrypt',
]);
export function validateTransforms(options) {
  if (
    options.preserveEncoding !== undefined &&
    typeof options.preserveEncoding !== 'boolean'
  ) {
    throw failure('ERR_CONFIG');
  }
  if (
    options.transformations !== undefined &&
    (!options.transformations ||
      typeof options.transformations !== 'object' ||
      Array.isArray(options.transformations))
  ) {
    throw failure('ERR_CONFIG');
  }
  for (const transform of [
    options.transformation,
    ...Object.values(options.transformations ?? {}),
  ].filter((t) => t !== undefined)) {
    validateTransform(transform);
  }
}
function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}
const poolTypes = new Set(['ORGANIZATION', 'LOCATION', 'EDUCATION']);
function validPools(pools) {
  return (
    pools === undefined ||
    (Boolean(pools) &&
      typeof pools === 'object' &&
      !Array.isArray(pools) &&
      Object.entries(pools).every(
        ([type, names]) =>
          poolTypes.has(type) &&
          Array.isArray(names) &&
          names.length > 0 &&
          names.every((name) => typeof name === 'string' && name.trim())
      ))
  );
}
function validateTransform(transform) {
  if (typeof transform === 'function') {
    return;
  }
  if (!transform || !modes.has(transform.mode)) {
    throw failure('ERR_CONFIG');
  }
  if (transform.mode === 'placeholder') {
    validatePlaceholder(transform);
  }
  const checks = {
    fake: () =>
      typeof transform.key === 'string' &&
      Buffer.byteLength(transform.key) >= 16 &&
      (transform.credentials === undefined ||
        typeof transform.credentials === 'boolean') &&
      (transform.mrzCountry === undefined || transform.mrzCountry === 'UTO') &&
      validPools(transform.pools),
    pseudonym: () =>
      typeof transform.key === 'string' &&
      Buffer.byteLength(transform.key) >= 16,
    'format-preserving': () =>
      typeof transform.key === 'string' &&
      Buffer.byteLength(transform.key) >= 16,
    'date-shift': () =>
      Number.isSafeInteger(transform.days) &&
      Math.abs(transform.days) <= 365000,
    bucket: () => positiveInteger(transform.size),
    mask: () => validMask(transform),
    encrypt: () =>
      typeof transform.key === 'string' &&
      Buffer.byteLength(transform.key) >= 16,
  };
  if (checks[transform.mode] && !checks[transform.mode]()) {
    throw failure('ERR_CONFIG');
  }
}

function keyed(value, type, key, suffix = '') {
  return createHmac('sha256', key)
    .update(`${type}\0${value}\0${suffix}`)
    .digest();
}
function formatPseudonym(value, type, key) {
  const result = Array.from(value, (char, i) => {
    const alphabet = /\d/.test(char)
      ? '0123456789'
      : /[A-Z]/.test(char)
        ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        : /[a-z]/.test(char)
          ? 'abcdefghijklmnopqrstuvwxyz'
          : /\p{L}/u.test(char)
            ? 'abcdefghijklmnopqrstuvwxyz'
            : undefined;
    return alphabet
      ? alphabet[keyed(value, type, key, String(i))[0] % alphabet.length]
      : char;
  }).join('');
  return result === value ? REDACTED : result;
}
function shiftedDate(value, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return REDACTED;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return REDACTED;
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.getUTCFullYear() < 0 || date.getUTCFullYear() > 9999
    ? REDACTED
    : date.toISOString().slice(0, 10);
}
// Google charactersToIgnore/commonCharactersToIgnore and Presidio-style
// character classes that a mask may leave visible.
const maskClasses = {
  digits: /\p{Nd}/u,
  upper: /\p{Lu}/u,
  lower: /\p{Ll}/u,
  punctuation: /[\p{P}\p{S}]/u,
  whitespace: /\s/u,
};
const maskTuning = ['char', 'ignore', 'ignoreClasses', 'count', 'fromEnd'];
const unset = (value, test) => value === undefined || test(value);
const maskChecks = [
  (t) =>
    [t.keepStart ?? 0, t.keepEnd ?? 0].every(
      (value) => Number.isSafeInteger(value) && value >= 0
    ),
  (t) => unset(t.minLength, positiveInteger),
  (t) =>
    unset(
      t.marker,
      (marker) =>
        !maskTuning.some((key) => t[key] !== undefined) &&
        typeof marker === 'string' &&
        marker.length > 0 &&
        marker.length <= 64
    ),
  (t) =>
    unset(
      t.char,
      (char) => typeof char === 'string' && Array.from(char).length === 1
    ),
  (t) =>
    unset(
      t.ignore,
      (ignore) =>
        typeof ignore === 'string' && ignore.length > 0 && ignore.length <= 256
    ),
  (t) =>
    unset(
      t.ignoreClasses,
      (names) =>
        Array.isArray(names) &&
        names.every((name) => Object.hasOwn(maskClasses, name))
    ),
  (t) => unset(t.count, positiveInteger),
  (t) => unset(t.fromEnd, (value) => typeof value === 'boolean'),
];
function validMask(transform) {
  return maskChecks.every((check) => check(transform));
}
function masked(value, finding, transform) {
  const chars = Array.from(value),
    start = transform.keepStart ?? 0,
    end = transform.keepEnd ?? 0;
  if (
    chars.length <
      (transform.minLength ?? (isIdentityType(finding.type) ? 5 : 0)) ||
    start + end >= chars.length
  ) {
    return REDACTED;
  }
  if (transform.marker !== undefined) {
    return `${chars.slice(0, start).join('')}${transform.marker}${end ? chars.slice(-end).join('') : ''}`;
  }
  const ignored = (char) =>
    Boolean(transform.ignore?.includes(char)) ||
    (transform.ignoreClasses ?? []).some((name) =>
      maskClasses[name].test(char)
    );
  let positions = [];
  for (let i = start; i < chars.length - end; i++) {
    if (!ignored(chars[i])) {
      positions.push(i);
    }
  }
  if (transform.fromEnd) {
    positions.reverse();
  }
  if (transform.count !== undefined) {
    positions = positions.slice(0, transform.count);
  }
  if (!positions.length) {
    return REDACTED;
  }
  for (const i of positions) {
    chars[i] = transform.char ?? '*';
  }
  return chars.join('');
}
function transformed(value, finding, transform, options) {
  if (typeof transform === 'function') {
    const result = transform(Object.freeze({ ...finding, value }));
    if (result && typeof result.then === 'function') {
      Promise.resolve(result).catch(() => {});
      throw failure('ERR_CONFIG');
    }
    return verifiedCallback(value, result);
  }
  if (!transform || transform.mode === 'redact') {
    return REDACTED;
  }
  if (transform.mode === 'hive-mask') {
    const chars = Array.from(value);
    return chars.length > 12
      ? `${chars.slice(0, 3).join('')}…${chars.slice(-3).join('')}`
      : REDACTED;
  }
  if (transform.mode === 'fake') {
    return realisticFake(value, finding, transform, options);
  }
  if (finding.category === 'credential') {
    return REDACTED;
  }
  if (transform.mode === 'mask') {
    return masked(value, finding, transform);
  }
  if (transform.mode === 'encrypt') {
    return encryptValue(value, finding.type, transform.key);
  }
  if (transform.mode === 'pseudonym') {
    return `[PSEUDONYM_${keyed(value, finding.type, transform.key).toString('hex').slice(0, 24)}]`;
  }
  if (transform.mode === 'format-preserving') {
    return formatPseudonym(value, finding.type, transform.key);
  }
  if (transform.mode === 'date-shift') {
    return shiftedDate(value, transform.days);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    return REDACTED;
  }
  const lower = Math.floor(number / transform.size) * transform.size;
  return `${lower}–${lower + transform.size - 1}`;
}
export function renderReplacement(
  text,
  finding,
  options,
  encodedSanitize,
  jsonRanges
) {
  if (finding.type === 'JSON_VALUE') {
    return JSON.stringify(REDACTED);
  }
  const transform =
    options.transformations?.[finding.type] ??
    options.transformation ??
    (options.identityMask && isIdentityType(finding.type)
      ? { mode: 'mask', keepStart: 2, keepEnd: 2, marker: '***', minLength: 5 }
      : undefined);
  if (finding.type === 'ENCODED_SENSITIVE') {
    const raw = text.slice(finding.start, finding.end);
    const run = encodedValue(raw);
    if (run && (options.preserveEncoding || run.encoding === 'json-content')) {
      const sanitized = encodedSanitize(run.text).text;
      // Mapped escaped fragments can lose their detecting context on decode.
      // Redact the fragment if recursive scanning makes no progress.
      return encodeRun(run, sanitized === run.text ? REDACTED : sanitized);
    }
    if (options.preserveEncoding) {
      throw failure('ERR_ENCODING');
    }
  }
  return renderValue(text, finding, transform, options, jsonRanges);
}
function replacementInput(
  text,
  finding,
  jsonRanges = [],
  decodeQuoted = false
) {
  let raw = text.slice(finding.start, finding.end);
  const inJsonString = jsonRanges.some(
    (range) => range.start <= finding.start && range.end >= finding.end
  );
  const jsonQuoted =
    (text[finding.start - 1] === '"' && text[finding.end] === '"') ||
    inJsonString;
  // Quotes can also surround ordinary decoded prose containing literal tabs.
  // Decode escapes only when the structured walker confirmed a JSON string.
  if (inJsonString || (decodeQuoted && jsonQuoted)) {
    try {
      raw = JSON.parse(`"${raw}"`);
    } catch {
      if (decodeQuoted) {
        return { invalid: true };
      }
      throw failure('ERR_JSON');
    }
  }
  return { raw, jsonQuoted };
}
function renderValue(text, finding, transform, options, jsonRanges) {
  const { raw, jsonQuoted, invalid } = replacementInput(
    text,
    finding,
    typeof transform === 'function' ? jsonRanges : undefined,
    typeof transform !== 'function'
  );
  if (invalid) {
    return REDACTED;
  }
  const result =
    transform?.mode === 'placeholder'
      ? placeholderReplacement(raw, finding, transform, options)
      : transformed(raw, finding, transform, options);
  return jsonQuoted ? JSON.stringify(result).slice(1, -1) : result;
}

export const hasCustomTransforms = (options) =>
  [
    options.transformation,
    ...Object.values(options.transformations ?? {}),
  ].some((t) => typeof t === 'function');
function verifiedCallback(value, result) {
  if (typeof result !== 'string') {
    throw failure('ERR_CONFIG');
  }
  const normalize = (s) => projectText(s).text.toLowerCase();
  const originals = [
    value,
    ...Array.from(decodedRuns(value), (run) => run.text),
  ]
    .map(normalize)
    .filter(Boolean);
  if (
    [result, ...Array.from(decodedRuns(result), (run) => run.text)].some(
      (view) => originals.some((original) => normalize(view).includes(original))
    )
  ) {
    throw failure('ERR_RESIDUAL');
  }
  return result;
}
export async function renderCallbackAsync(text, finding, callback, jsonRanges) {
  const { raw, jsonQuoted } = replacementInput(text, finding, jsonRanges);
  const result = verifiedCallback(
    raw,
    await callback(Object.freeze({ ...finding, value: raw }))
  );
  return jsonQuoted ? JSON.stringify(result).slice(1, -1) : result;
}
