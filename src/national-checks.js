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
