import { createHmac } from 'node:crypto';
import { failure, REDACTED } from './detection.js';
import { encodedValue, encodeRun } from './encoded.js';
import { isIdentityType } from './identity.js';

const modes = new Set([
  'redact',
  'hive-mask',
  'mask',
  'pseudonym',
  'format-preserving',
  'date-shift',
  'bucket',
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
function validateTransform(transform) {
  if (!transform || !modes.has(transform.mode)) {
    throw failure('ERR_CONFIG');
  }
  const checks = {
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
    mask: () =>
      [transform.keepStart ?? 0, transform.keepEnd ?? 0].every(
        (value) => Number.isSafeInteger(value) && value >= 0
      ) &&
      (transform.minLength === undefined ||
        positiveInteger(transform.minLength)) &&
      (transform.marker === undefined ||
        (typeof transform.marker === 'string' &&
          transform.marker.length > 0 &&
          transform.marker.length <= 64)),
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
function masked(value, finding, transform) {
  const chars = Array.from(value),
    start = transform.keepStart ?? 0,
    end = transform.keepEnd ?? 0;
  return chars.length <
    (transform.minLength ?? (isIdentityType(finding.type) ? 5 : 0)) ||
    start + end >= chars.length
    ? REDACTED
    : `${chars.slice(0, start).join('')}${transform.marker ?? '*'.repeat(chars.length - start - end)}${end ? chars.slice(-end).join('') : ''}`;
}
function transformed(value, finding, transform) {
  if (!transform || transform.mode === 'redact') {
    return REDACTED;
  }
  if (transform.mode === 'hive-mask') {
    const chars = Array.from(value);
    return chars.length > 12
      ? `${chars.slice(0, 3).join('')}…${chars.slice(-3).join('')}`
      : REDACTED;
  }
  if (finding.category === 'credential') {
    return REDACTED;
  }
  if (transform.mode === 'mask') {
    return masked(value, finding, transform);
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
export function renderReplacement(text, finding, options, encodedSanitize) {
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
      return encodeRun(run, encodedSanitize(run.text).text);
    }
    if (options.preserveEncoding) {
      throw failure('ERR_ENCODING');
    }
  }
  let raw = text.slice(finding.start, finding.end);
  const jsonQuoted =
    text[finding.start - 1] === '"' && text[finding.end] === '"';
  if (jsonQuoted) {
    try {
      raw = JSON.parse(`"${raw}"`);
    } catch {
      return REDACTED;
    }
  }
  const result = transformed(raw, finding, transform);
  return jsonQuoted ? JSON.stringify(result).slice(1, -1) : result;
}
