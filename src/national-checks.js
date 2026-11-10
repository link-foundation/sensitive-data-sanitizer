// Format arithmetic; these checks are confidence signals, not verification of
// issuance. Short-number Luhn is separate from the public credit-card helper.
export const digitsOf = (value) => value.replace(/\D/g, '');
const sum = (digits, weights) =>
  weights.reduce((total, weight, i) => total + Number(digits[i]) * weight, 0);
export function shortLuhn(value) {
  const digits = digitsOf(value);
  let total = 0;
  for (
    let i = digits.length - 1, double = false;
    i >= 0;
    i--, double = !double
  ) {
    let digit = Number(digits[i]);
    if (double) {
      digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2;
    }
    total += digit;
  }
  return digits.length > 0 && !/^(\d)\1+$/.test(digits) && total % 10 === 0;
}
export function datePart(digits, monthOffset = 0, dayOffset = 0) {
  const month = Number(digits.slice(2, 4)) - monthOffset;
  const day = Number(digits.slice(4, 6)) - dayOffset;
  const year = 2000 + Number(digits.slice(0, 2));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
export function nhs(value) {
  const d = digitsOf(value),
    check = (11 - (sum(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]) % 11)) % 11;
  return (
    d.length === 10 &&
    !/^(\d)\1+$/.test(d) &&
    check < 10 &&
    check === Number(d[9])
  );
}
export function snils(value) {
  const d = digitsOf(value),
    check = sum(d, [9, 8, 7, 6, 5, 4, 3, 2, 1]) % 101;
  return (
    d.length === 11 &&
    !/^(\d)\1+$/.test(d) &&
    (check === 100 ? 0 : check) === Number(d.slice(9))
  );
}
export function inn(value) {
  const d = digitsOf(value),
    check = (weights) => (sum(d, weights) % 11) % 10;
  if (/^(\d)\1+$/.test(d)) {
    return false;
  }
  return d.length === 10
    ? check([2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(d[9])
    : d.length === 12 &&
        check([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(d[10]) &&
        check([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === Number(d[11]);
}
export function pesel(value) {
  const d = digitsOf(value),
    month = Number(d.slice(2, 4));
  return (
    d.length === 11 &&
    datePart(d, Math.floor(month / 20) * 20) &&
    (10 - (sum(d, [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]) % 10)) % 10 === Number(d[10])
  );
}
export function rrn(value) {
  const d = digitsOf(value);
  return (
    d.length === 13 &&
    datePart(d) &&
    (11 - (sum(d, [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5]) % 11)) % 10 ===
      Number(d[12])
  );
}
export function tfn(value) {
  const d = digitsOf(value);
  return (
    d.length === 9 &&
    !/^(\d)\1+$/.test(d) &&
    sum(d, [1, 4, 3, 7, 5, 8, 6, 9, 10]) % 11 === 0
  );
}
export function nric(value) {
  const v = value.toUpperCase(),
    prefix = v[0];
  const offset = { S: 0, T: 4, F: 0, G: 4, M: 3 }[prefix];
  const alphabet = /[ST]/.test(prefix)
    ? 'JZIHGFEDCBA'
    : prefix === 'M'
      ? 'KLJNPQRTUWX'
      : 'XWUTRQPNMLK';
  const index = (sum(v.slice(1, 8), [2, 7, 6, 5, 4, 3, 2]) + offset) % 11;
  return (
    /^[STFGM]\d{7}[A-Z]$/.test(v) &&
    alphabet[prefix === 'M' ? 10 - index : index] === v[8]
  );
}
export function fiscalCode(value) {
  const odd = [
    1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16,
    10, 22, 25, 24, 23,
  ];
  let total = 0;
  for (let i = 0; i < 15; i++) {
    const char = value[i],
      position = /\d/.test(char) ? Number(char) : char.charCodeAt(0) - 65;
    total += i % 2 === 0 ? odd[position] : position;
  }
  return String.fromCharCode(65 + (total % 26)) === value[15];
}
export function personnummer(value) {
  const d = digitsOf(value).slice(-10),
    day = Number(d.slice(4, 6));
  return d.length === 10 && datePart(d, 0, day > 60 ? 60 : 0) && shortLuhn(d);
}
export function southAfricanId(value) {
  return (
    datePart(value) &&
    /^[0-2][89]$/.test(value.slice(10, 12)) &&
    shortLuhn(value)
  );
}
const repeated = (digits) => /^(\d)\1+$/.test(digits);
// US ABA routing transit number: Federal Reserve prefix and 3-7-1 weights.
export function abaRouting(value) {
  const d = digitsOf(value),
    prefix = Number(d.slice(0, 2));
  return (
    d.length === 9 &&
    !repeated(d) &&
    (prefix <= 12 ||
      (prefix >= 21 && prefix <= 32) ||
      (prefix >= 61 && prefix <= 72) ||
      prefix === 80) &&
    sum(d, [3, 7, 1, 3, 7, 1, 3, 7, 1]) % 10 === 0
  );
}
const dniLetters = 'TRWAGMYFPDXBNJZSQVHLCKE';
// Spanish NIE: X/Y/Z stands for 0/1/2 before the DNI mod-23 letter.
export function spanishNie(value) {
  const v = value.toUpperCase();
  return (
    /^[XYZ]\d{7}[A-Z]$/.test(v) &&
    dniLetters[Number(`${'XYZ'.indexOf(v[0])}${v.slice(1, 8)}`) % 23] === v[8]
  );
}
// Australian Business Number: subtract one from the first digit, mod 89.
export function abn(value) {
  const d = digitsOf(value).split('').map(Number);
  if (d.length !== 11 || repeated(d.join(''))) {
    return false;
  }
  d[0] -= 1;
  return sum(d, [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]) % 89 === 0;
}
// Australian Company Number: weighted complement mod 10.
export function acn(value) {
  const d = digitsOf(value);
  return (
    d.length === 9 &&
    !repeated(d) &&
    (10 - (sum(d, [8, 7, 6, 5, 4, 3, 2, 1]) % 10)) % 10 === Number(d[8])
  );
}
// Australian Medicare card: first digit 2-6, ninth digit is the check digit.
export function medicare(value) {
  const d = digitsOf(value);
  return (
    /^[2-6]\d{9,10}$/.test(d) &&
    sum(d, [1, 3, 7, 9, 1, 3, 7, 9]) % 10 === Number(d[8])
  );
}
const verhoeffD = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const verhoeffP = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
export function verhoeff(value) {
  const d = digitsOf(value);
  let check = 0;
  for (let i = 0; i < d.length; i++) {
    check = verhoeffD[check][verhoeffP[i % 8][Number(d[d.length - 1 - i])]];
  }
  return d.length > 0 && !repeated(d) && check === 0;
}
// Indian Aadhaar: 12 digits, never starting with 0 or 1, Verhoeff check.
export const aadhaar = (value) =>
  /^[2-9]\d{11}$/.test(digitsOf(value)) && verhoeff(value);
const base36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// Indian GSTIN: state code, PAN, entity number, "Z", mod-36 check character.
export function gstin(value) {
  const v = value.toUpperCase();
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v)) {
    return false;
  }
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const product = base36.indexOf(v[i]) * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  return base36[(36 - (total % 36)) % 36] === v[14];
}
// Finnish henkilötunnus: DDMMYY, century sign, individual number, mod 31.
export function finnishIdentityCode(value) {
  const v = value.toUpperCase(),
    match = /^(\d{6})([-+A-FU-Y])(\d{3})([0-9A-Y])$/.exec(v);
  if (!match) {
    return false;
  }
  const [, date, , individual, check] = match;
  const swapped = `${date.slice(4, 6)}${date.slice(2, 4)}${date.slice(0, 2)}`;
  return (
    datePart(swapped) &&
    '0123456789ABCDEFHJKLMNPRSTUVWXY'[Number(date + individual) % 31] === check
  );
}
// Thai national identification number: 13 digits, weighted mod 11.
export function thaiId(value) {
  const d = digitsOf(value);
  return (
    /^[1-8]\d{12}$/.test(d) &&
    (11 - (sum(d, [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) % 11)) % 10 ===
      Number(d[12])
  );
}
// US DEA registration: registrant letter, name letter or 9, six digits, check.
export function dea(value) {
  const v = value.toUpperCase();
  if (!/^[ABCDEFGHJKLMPRSTUX][A-Z9]\d{7}$/.test(v)) {
    return false;
  }
  const d = v.slice(2);
  return (
    (Number(d[0]) +
      Number(d[2]) +
      Number(d[4]) +
      2 * (Number(d[1]) + Number(d[3]) + Number(d[5]))) %
      10 ===
    Number(d[6])
  );
}
const regions = new Intl.DisplayNames(['en'], {
  type: 'region',
  fallback: 'none',
});
// ISO 3166 alpha-2 region known to the runtime's Unicode CLDR data.
export const regionCode = (code) =>
  /^[A-Z]{2}$/.test(code) && code !== 'ZZ' && regions.of(code) !== undefined;
// SWIFT/BIC: bank, ISO country, location, optional branch.
export const swiftCode = (value) =>
  /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/.test(value) &&
  regionCode(value.slice(4, 6));
