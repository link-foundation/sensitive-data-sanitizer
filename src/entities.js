import google from './vendor/entities/google.json' with { type: 'json' };
import azure from './vendor/entities/azure.json' with { type: 'json' };
import aws from './vendor/entities/aws.json' with { type: 'json' };
import { escapePattern, collectMatches } from './detection.js';
import { valueRange } from './context.js';
export const entityCatalogs = { google, azure, aws };
const canonical = (name) =>
  name.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
const entries = new Map();
for (const [vendor, catalog] of Object.entries(entityCatalogs)) {
  for (const name of catalog.names) {
    const normalized = canonical(name);
    const type =
      {
        NAME: 'PERSON',
        EMAIL_ADDRESS: 'EMAIL',
        PHONE_NUMBER: 'PHONE',
        PERSON_NAME: 'PERSON',
        USER_NAME: 'USERNAME',
      }[normalized] ?? normalized;
    if (type.length > 64) {
      continue;
    }
    const entry = {
      type,
      rule: `catalog/${vendor}`,
      category:
        /PASSWORD|SECRET|TOKEN|AUTH|ACCESS_KEY|PRIVATE_KEY|CREDENTIAL|CONNECTION.*STRING|^PIN$|CVV|CVC/.test(
          type
        )
          ? 'credential'
          : 'personal',
    };
    entries.set(normalized, entry);
    entries.set(name.toUpperCase(), entry);
  }
}
// All documented names are native labelled recognizers; automatic format
// recognizers are separate and do not claim the vendors' model behavior.
const prefix = new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:["'])?(${[...entries.keys()].map(escapePattern).join('|')})(?:["'])?\\s*[:=：]\\s*`,
  'giu'
);
export function detectCatalog(text, emit) {
  for (const match of text.matchAll(prefix)) {
    const entry = entries.get(match[1].toUpperCase());
    const mode = /[?&]$/.test(text.slice(0, match.index))
      ? 'query'
      : /["']\s*[:：]/.test(match[0])
        ? 'token'
        : 'line';
    const range = valueRange(text, match.index + match[0].length, mode);
    if (
      range &&
      text.slice(range.start, range.end).trim() &&
      !text.slice(range.start, range.end).startsWith('[REDACTED]')
    ) {
      emit({ ...range, ...entry, confidence: 0.95 });
    }
  }
  for (const [type, pattern, accept] of formatRules) {
    collectMatches(
      text,
      pattern,
      emit,
      { type, category: 'personal', rule: 'entity-format', confidence: 0.85 },
      0,
      accept
    );
  }
}
function cpf(value) {
  const d = value.replace(/\D/g, '');
  if (/^(\d)\1+$/.test(d)) {
    return false;
  }
  for (const n of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += Number(d[i]) * (n + 1 - i);
    }
    if (((sum * 10) % 11) % 10 !== Number(d[n])) {
      return false;
    }
  }
  return true;
}
function npi(value) {
  if (!/^[12]\d{9}$/.test(value)) {
    return false;
  }
  const digits = `80840${value}`;
  let sum = 0;
  for (
    let i = digits.length - 1, doubled = false;
    i >= 0;
    i--, doubled = !doubled
  ) {
    let d = Number(digits[i]);
    if (doubled) {
      d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
const formatRules = [
  ['BRAZIL_CPF_NUMBER', /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, cpf],
  [
    'INDIA_PAN_INDIVIDUAL',
    /\b[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]\b/g,
    () => true,
  ],
  [
    'UK_NATIONAL_INSURANCE_NUMBER',
    /\b(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z]{2}[ ]?\d{2}[ ]?\d{2}[ ]?\d{2}[ ]?[A-D]\b/g,
    () => true,
  ],
  [
    'SPAIN_DNI_NUMBER',
    /\b\d{8}[A-Z]\b/g,
    (v) => 'TRWAGMYFPDXBNJZSQVHLCKE'[Number(v.slice(0, 8)) % 23] === v.at(-1),
  ],
  [
    'CRYPTO_WALLET',
    /\b(?:0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[ac-hj-np-z02-9]{25,62})\b/g,
    () => true,
  ],
  ['US_HEALTHCARE_NPI', /\b[12]\d{9}\b/g, npi],
];
