import { createHmac } from 'node:crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { mrzCheck } from './identity.js';
import { fakeName } from './fake-names.js';
import * as checks from './national-checks.js';
import { REDACTED, failure } from './detection.js';

const generated = new WeakMap();
export function generatedValues(options) {
  const transforms = [
    options.transformation,
    ...Object.values(options.transformations ?? {}),
  ];
  return transforms.flatMap((t) =>
    t?.mode === 'fake'
      ? [...(generated.get(t) ?? [])].map(([value, credential]) => ({
          value,
          credential,
        }))
      : []
  );
}
function remember(value, transform, credential) {
  let values = generated.get(transform);
  if (!values) {
    values = new Map();
    generated.set(transform, values);
  }
  if (values.size >= 100000 && !values.has(value)) {
    throw failure('ERR_LIMIT');
  }
  values.set(value, credential);
  return value;
}
function digest(value, key, purpose = 'value') {
  return createHmac('sha256', key).update(`${purpose}\0${value}`).digest();
}
function patternFake(value, key) {
  const bytes = digest(value, key);
  return Array.from(value, (c, i) => {
    const alphabet = /\d/.test(c)
      ? '0123456789'
      : /[A-Z]/.test(c)
        ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        : /[a-z]/.test(c)
          ? 'abcdefghijklmnopqrstuvwxyz'
          : undefined;
    return alphabet
      ? alphabet[
          (alphabet.indexOf(c) +
            1 +
            (bytes[i % bytes.length] % (alphabet.length - 1))) %
            alphabet.length
        ]
      : c;
  }).join('');
}
function replaceDigits(value, digits) {
  let i = 0;
  return value.replace(/\d/g, () => digits[i++]);
}
export function fakeDate(value, key, short = false, birth = true) {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value),
    local = /^(\d{1,2})([/.])(\d{1,2})\2(\d{4})$/.exec(value);
  let year, month, day;
  if (short && /^\d{6}$/.test(value)) {
    year =
      (birth && Number(value.slice(0, 2)) > 26 ? 1900 : 2000) +
      Number(value.slice(0, 2));
    month = Number(value.slice(2, 4));
    day = Number(value.slice(4, 6));
  } else if (iso) {
    [, year, month, day] = iso.map(Number);
  } else if (local) {
    year = Number(local[4]);
    month = Number(local[3]);
    day = Number(local[1]);
  } else {
    return REDACTED;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return REDACTED;
  }
  // One private offset for the entire key, independent of type and spelling.
  const days = -((digest('calendar', key, 'date').readUInt16BE(0) % 365) + 1);
  date.setUTCDate(date.getUTCDate() + days);
  const y = String(date.getUTCFullYear()).padStart(4, '0'),
    m = String(date.getUTCMonth() + 1).padStart(2, '0'),
    d = String(date.getUTCDate()).padStart(2, '0');
  return short
    ? y.slice(-2) + m + d
    : iso
      ? `${y}-${m}-${d}`
      : `${d}${local[2]}${m}${local[2]}${y}`;
}
const validators = {
  UK_NHS: checks.nhs,
  KR_RRN: checks.rrn,
  IT_FISCAL_CODE: checks.fiscalCode,
  SG_NRIC_FIN: checks.nric,
  PL_PESEL: checks.pesel,
  SE_PERSONNUMMER: checks.personnummer,
  ZA_ID_NUMBER: checks.southAfricanId,
  AU_TFN: checks.tfn,
  CA_SIN: checks.shortLuhn,
  RU_SNILS: checks.snils,
  RU_INN: checks.inn,
  CREDIT_CARD: checks.shortLuhn,
  US_HEALTHCARE_NPI: (v) => checks.shortLuhn(`80840${v}`),
  SPAIN_DNI_NUMBER: (v) =>
    'TRWAGMYFPDXBNJZSQVHLCKE'[Number(v.slice(0, 8)) % 23] === v.at(-1),
  BRAZIL_CPF_NUMBER: cpf,
};
function cpf(d) {
  for (const n of [9, 10]) {
    const sum = Array.from(d.slice(0, n)).reduce(
      (s, c, i) => s + Number(c) * (n + 1 - i),
      0
    );
    if (((sum * 10) % 11) % 10 !== Number(d[n])) {
      return false;
    }
  }
  return true;
}
function fakeId(value, type, key) {
  type =
    {
      UK_NHS_NUMBER: 'UK_NHS',
      AU_TAX_FILE_NUMBER: 'AU_TFN',
      SOUTH_AFRICA_ID_NUMBER: 'ZA_ID_NUMBER',
      ITALY_FISCAL_CODE: 'IT_FISCAL_CODE',
      CANADA_SOCIAL_INSURANCE_NUMBER: 'CA_SIN',
      CREDIT_CARD_NUMBER: 'CREDIT_CARD',
      CREDIT_DEBIT_NUMBER: 'CREDIT_CARD',
    }[type] ?? type;
  const compact = value.replace(/[^A-Za-z0-9]/g, '');
  let candidate = patternFake(compact, key);
  if (/^IBAN(?:_CODE)?$/.test(type)) {
    candidate = fakeIban(compact, candidate);
  }
  candidate = idDate(compact, candidate, type, key);
  if (candidate === REDACTED) {
    return REDACTED;
  }
  candidate = idShape(compact, candidate, type);
  candidate = idChecks(compact, candidate, type);
  if (candidate === REDACTED) {
    return REDACTED;
  }
  let i = 0;
  return value.replace(/[A-Za-z0-9]/g, () => candidate[i++]);
}
function fakeIban(compact, candidate) {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) {
    return REDACTED;
  }
  const country = compact.slice(0, 2),
    account = candidate.slice(4);
  let remainder = 0;
  for (const c of `${account}${country}00`) {
    const digits = /\d/.test(c) ? c : String(c.charCodeAt(0) - 55);
    for (const d of digits) {
      remainder = (remainder * 10 + Number(d)) % 97;
    }
  }
  return `${country}${String(98 - remainder).padStart(2, '0')}${account}`;
}
function idDate(compact, candidate, type, key) {
  if (
    !['KR_RRN', 'PL_PESEL', 'SE_PERSONNUMMER', 'ZA_ID_NUMBER'].includes(type)
  ) {
    return candidate;
  }
  const width = type === 'SE_PERSONNUMMER' && compact.length === 12 ? 8 : 6;
  const original = compact.slice(0, width),
    yy = original.slice(-6);
  const offset =
    type === 'PL_PESEL' ? Math.floor(Number(yy.slice(2, 4)) / 20) * 20 : 0;
  const century =
    type === 'PL_PESEL'
      ? [1900, 2000, 2100, 2200, 1800][offset / 20]
      : width === 8
        ? Number(original.slice(0, 2)) * 100
        : Number(yy.slice(0, 2)) > 26
          ? 1900
          : 2000;
  const dayOffset =
    type === 'SE_PERSONNUMMER' && Number(yy.slice(4)) > 60 ? 60 : 0;
  const shifted = fakeDate(
    `${century + Number(yy.slice(0, 2))}-${String(Number(yy.slice(2, 4)) - offset).padStart(2, '0')}-${String(Number(yy.slice(4)) - dayOffset).padStart(2, '0')}`,
    key
  );
  if (shifted === REDACTED) {
    return REDACTED;
  }
  const [year, month, day] = shifted.split('-').map(Number);
  const monthOffset =
    type === 'PL_PESEL'
      ? { 1800: 80, 1900: 0, 2000: 20, 2100: 40, 2200: 60 }[
          Math.floor(year / 100) * 100
        ]
      : 0;
  if (monthOffset === undefined) {
    return REDACTED;
  }
  const date =
    (width === 8
      ? String(year).padStart(4, '0')
      : String(year % 100).padStart(2, '0')) +
    String(month + monthOffset).padStart(2, '0') +
    String(day + dayOffset).padStart(2, '0');
  return date + candidate.slice(width);
}
function idShape(compact, candidate, type) {
  if (type === 'KR_RRN') {
    candidate = candidate.slice(0, 6) + compact[6] + candidate.slice(7);
  }
  if (type === 'ZA_ID_NUMBER') {
    candidate =
      candidate.slice(0, 10) + compact.slice(10, 12) + candidate.slice(12);
  }
  if (type === 'SG_NRIC_FIN') {
    candidate = compact[0] + candidate.slice(1);
  }
  if (type === 'CREDIT_CARD') {
    candidate = compact.slice(0, 6) + candidate.slice(6);
  }
  if (type === 'US_HEALTHCARE_NPI') {
    candidate = compact[0] + candidate.slice(1);
  }
  if (type === 'IT_FISCAL_CODE') {
    candidate =
      candidate.slice(0, 8) +
      compact[8] +
      candidate.slice(9, 11) +
      compact[11] +
      candidate.slice(12);
  }
  if (type === 'INDIA_PAN_INDIVIDUAL') {
    candidate = candidate.slice(0, 3) + compact[3] + candidate.slice(4);
  }
  return candidate;
}
function idChecks(compact, candidate, type) {
  const validate = validators[type];
  if (validate) {
    const letters = [
      'SG_NRIC_FIN',
      'IT_FISCAL_CODE',
      'SPAIN_DNI_NUMBER',
    ].includes(type);
    const count =
      (type === 'RU_INN' && compact.length === 12) ||
      ['RU_SNILS', 'BRAZIL_CPF_NUMBER'].includes(type)
        ? 2
        : 1;
    const prefix = candidate.slice(0, -count);
    let found;
    // Fixed upper bound, including a second prefix when mod-11 has no digit.
    for (let attempt = 0; attempt < 20 && !found; attempt++) {
      const stem = attempt
        ? prefix.slice(0, -1) + String(attempt % 10)
        : prefix;
      for (let check = 0; check < (letters ? 26 : 10 ** count); check++) {
        const next =
          stem +
          (letters
            ? String.fromCharCode(65 + check)
            : String(check).padStart(count, '0'));
        if (validate(next) && next !== compact) {
          found = next;
          break;
        }
      }
    }
    if (!found) {
      return REDACTED;
    }
    candidate = found;
  }
  return candidate;
}
function ukDramaPhone(digits, code, suffix) {
  const international = code === '44' && digits.length === 12;
  const local = !code && digits.length === 11 && digits.startsWith('0');
  if (!international && !local) {
    return undefined;
  }
  const national = digits.slice(international ? 2 : 1);
  let prefix;
  if (/^7[1-57-9]/.test(national)) {
    prefix = '7700900';
  } else if (/^80[08]/.test(national)) {
    prefix = '8081570';
  } else if (national.startsWith('20')) {
    prefix = '2079460';
  } else if (/^[12]/.test(national)) {
    prefix = '1632960';
  } else if (national.startsWith('3')) {
    prefix = '3069990';
  }
  return prefix ? `${international ? '44' : '0'}${prefix}${suffix}` : undefined;
}
function fictionalPhone(digits, code, bytes) {
  const suffix = String(bytes.readUInt16BE(0) % 1000).padStart(3, '0');
  const uk = ukDramaPhone(digits, code, suffix);
  if (uk) {
    return uk;
  }
  if (code === '1' && digits.length === 11) {
    return `1${digits.slice(1, 4)}55501${String(bytes[0] % 100).padStart(2, '0')}`;
  }
  if (!code && digits.length === 10 && /^[2-9]\d{2}[2-9]/.test(digits)) {
    return `${digits.slice(0, 3)}55501${String(bytes[0] % 100).padStart(2, '0')}`;
  }
  return undefined;
}
function plausiblePhone(value, digits, code, key, parsed) {
  if (!parsed?.isValid()) {
    return undefined;
  }
  // Retain the national destination prefix when no fictional range exists.
  const prefix = digits.slice(0, code.length + 3);
  for (let attempt = 0; attempt < 32; attempt++) {
    const next =
      prefix +
      patternFake(digits, `${key}:phone:${attempt}`).slice(prefix.length);
    const check = parsePhoneNumberFromString(
      `${value.startsWith('+') ? '+' : ''}${next}`
    );
    if (
      next !== digits &&
      check?.isValid() &&
      check.getType() === parsed.getType()
    ) {
      return next;
    }
  }
  return undefined;
}
function russianMobile(digits, code) {
  return (
    (code === '7' && /^79\d{9}$/.test(digits)) ||
    (!code && /^89\d{9}$/.test(digits))
  );
}
function fakePhone(value, key) {
  const digits = value.replace(/\D/g, '');
  const parsed = parsePhoneNumberFromString(value);
  const code = value.startsWith('+')
    ? (parsed?.countryCallingCode ?? (/^\+7/.test(value) ? '7' : undefined))
    : '';
  if (code === undefined) {
    return REDACTED;
  }
  const bytes = digest(digits, key, 'phone');
  let number = fictionalPhone(digits, code, bytes);
  if (!number) {
    if (russianMobile(digits, code)) {
      number = digits.slice(0, 4) + patternFake(digits, key).slice(4);
    } else if (parsed?.isValid()) {
      number = plausiblePhone(value, digits, code, key, parsed);
      if (!number) {
        return REDACTED;
      }
    } else {
      number = code + patternFake(digits, key).slice(code.length);
      if (!code && digits.startsWith('0')) {
        number = `0${number.slice(1)}`;
      }
    }
  }
  if (number === digits) {
    number = number.slice(0, -1) + String((Number(number.at(-1)) + 1) % 10);
  }
  return replaceDigits(value, number);
}
function fakeMrz(value, transform) {
  const parts = value.split(/(\r?\n|\\n)/),
    country = transform.mrzCountry;
  if (
    parts.length === 5 &&
    parts.every((line, i) => i % 2 || line.length === 30) &&
    /^[IAC][A-Z<]/.test(parts[0])
  ) {
    return fakeTd1(parts, transform);
  }
  for (let i = 0; i < parts.length; i += 2) {
    const line = parts[i],
      header =
        /^([PVIA][A-Z<])([A-Z<]{3})([A-Z]+)<<([A-Z]+(?:<[A-Z]+)*)(<*)$/.exec(
          line
        );
    if (header) {
      const name = fakeName(
        `${header[3]} ${header[4].replaceAll('<', ' ')}`,
        transform.key
      )
        .toUpperCase()
        .replaceAll(' ', '<');
      const firstSpace = name.indexOf('<');
      parts[i] = `${
        header[1] + (country ?? header[2]) + name.slice(0, firstSpace)
      }<<${name.slice(firstSpace + 1)}`
        .slice(0, line.length)
        .padEnd(line.length, '<');
    } else if (/^[A-Z0-9<]{9}[\d<][A-Z<]{3}\d{6}[\d<][MF<]\d{6}/.test(line)) {
      const number = fakeId(line.slice(0, 9), 'PASSPORT_NUMBER', transform.key);
      const birth = fakeDate(line.slice(13, 19), transform.key, true),
        expiry = fakeDate(line.slice(21, 27), transform.key, true, false);
      if ([number, birth, expiry].includes(REDACTED)) {
        return REDACTED;
      }
      let result =
        number +
        mrzCheck(number) +
        (country ?? line.slice(10, 13)) +
        birth +
        mrzCheck(birth) +
        line[20] +
        expiry +
        mrzCheck(expiry);
      if (line.length === 44 && !value.startsWith('V')) {
        const optional = '<'.repeat(14);
        result += `${optional}0`;
        result += mrzCheck(
          result.slice(0, 10) + result.slice(13, 20) + result.slice(21, 43)
        );
      } else if (line.length === 36 && !value.startsWith('V')) {
        result += '<'.repeat(7);
        result += mrzCheck(
          result.slice(0, 10) + result.slice(13, 20) + result.slice(21, 35)
        );
      } else {
        result = result.padEnd(line.length, '<');
      }
      parts[i] = result;
    } else {
      return REDACTED;
    }
  }
  return parts.join('');
}
function fakeTd1(parts, transform) {
  const [header, , data, , names] = parts;
  const number = fakeId(header.slice(5, 14), 'PASSPORT_NUMBER', transform.key);
  const birth = fakeDate(data.slice(0, 6), transform.key, true);
  const expiry = fakeDate(data.slice(8, 14), transform.key, true, false);
  parts[0] =
    header.slice(0, 2) +
    (transform.mrzCountry ?? header.slice(2, 5)) +
    number +
    mrzCheck(number) +
    '<'.repeat(15);
  let result =
    birth +
    mrzCheck(birth) +
    data[7] +
    expiry +
    mrzCheck(expiry) +
    (transform.mrzCountry ?? data.slice(15, 18)) +
    '<'.repeat(11);
  result += mrzCheck(
    parts[0].slice(5, 30) +
      result.slice(0, 7) +
      result.slice(8, 15) +
      result.slice(18, 29)
  );
  parts[2] = result;
  const [surname, given] = names.replace(/<+$/, '').split('<<');
  if (!given || birth === REDACTED || expiry === REDACTED) {
    return REDACTED;
  }
  parts[4] = `${fakeName(surname, transform.key).toUpperCase()}<<${fakeName(
    given.replaceAll('<', ' '),
    transform.key
  )
    .toUpperCase()
    .replaceAll(' ', '<')}`
    .slice(0, 30)
    .padEnd(30, '<');
  return parts.join('');
}
export function realisticFake(value, finding, transform) {
  let output;
  if (finding.category === 'credential') {
    if (!transform.credentials) {
      return REDACTED;
    }
    const prefix =
      /^(ghp_|github_pat_|sk-|xox[baprs]-)/.exec(value)?.[0] ?? 'credential_';
    // Punctuation intentionally violates every provider token alphabet/length.
    output = `${prefix}FAKE_${digest(value, transform.key)
      .toString('hex')
      .slice(0, 8)}!`;
  } else if (finding.type === 'PERSON') {
    output = fakeName(value, transform.key);
  } else if (/DATE|BIRTH/.test(finding.type)) {
    output = fakeDate(value, transform.key);
  } else if (finding.type === 'PASSPORT_MRZ') {
    output = fakeMrz(value, transform);
  } else if (finding.type === 'PHONE') {
    output = fakePhone(value, transform.key);
  } else if (finding.type === 'EMAIL') {
    output = `fake.${digest(value, transform.key)
      .toString('hex')
      .slice(0, 12)}@example.com`;
  } else if (/DOMAIN|URL/.test(finding.type)) {
    output = `fake-${digest(value, transform.key)
      .toString('hex')
      .slice(0, 12)}.test`;
  } else {
    output = fakeId(value, finding.type, transform.key);
  }
  return output === value || output === REDACTED
    ? REDACTED
    : remember(output, transform, finding.category === 'credential');
}
