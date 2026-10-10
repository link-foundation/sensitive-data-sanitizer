import { numericNoise, epochNumber } from './confidence.js';
import {
  digitsOf,
  datePart,
  nhs,
  snils,
  inn,
  pesel,
  rrn,
  tfn,
  nric,
  fiscalCode,
  personnummer,
  southAfricanId,
  shortLuhn,
} from './national-checks.js';

const rules = [
  [
    'UK_NHS',
    /\d{3}[ -]?\d{3}[ -]?\d{4}/g,
    /\b(?:NHS|patient|healthcare|provider)\b/i,
    nhs,
  ],
  [
    'KR_RRN',
    /\d{6}[ -]?[1-8]\d{6}/g,
    /\bRRN\b|주민등록/iu,
    rrn,
    (v) => datePart(digitsOf(v)),
  ],
  [
    'IT_FISCAL_CODE',
    /[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]/g,
    /\bCF\b|codice fiscale/iu,
    fiscalCode,
    () => true,
  ],
  ['SG_NRIC_FIN', /[STFGM]\d{7}[A-Z]/g, /\b(?:NRIC|FIN)\b/iu, nric, () => true],
  ['PL_PESEL', /\d{11}/g, /\bPESEL\b/iu, pesel],
  [
    'SE_PERSONNUMMER',
    /(?:\d{2})?\d{6}[-+]\d{4}/g,
    /personnummer/iu,
    personnummer,
  ],
  [
    'ZA_ID_NUMBER',
    /\d{10}[0-2][89]\d/g,
    /\b(?:SA ID|RSA ID)\b|south african id/iu,
    southAfricanId,
  ],
  ['AU_TFN', /\d{3}[ -]?\d{3}[ -]?\d{3}/g, /\bTFN\b|tax file number/iu, tfn],
  [
    'CA_SIN',
    /\d{3}[ -]?\d{3}[ -]?\d{3}/g,
    /\bSIN\b|social insurance/iu,
    shortLuhn,
  ],
  [
    'RU_SNILS',
    /\d{3}[- ]\d{3}[- ]\d{3}[ -]\d{2}|\d{11}/g,
    /\bSNILS\b|снилс|пенсионное|страховое свидетельство|страховой номер/iu,
    snils,
  ],
  ['RU_INN', /\d{12}|\d{10}/g, /\bINN\b|инн/iu, inn],
];
function distinctiveShape(type, value) {
  return (
    (type === 'RU_SNILS' && /^\d{3}([- ])\d{3}\1\d{3} \d{2}$/.test(value)) ||
    (type === 'RU_INN' && value.length === 12)
  );
}
export function detectNational(text, emit) {
  for (const [type, pattern, context, checksum, plausible] of rules) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index,
        end = start + match[0].length;
      if (!nationalBoundary(text, start, end)) {
        continue;
      }
      const hasContext = context.test(
        text.slice(Math.max(0, start - 64), end + 32)
      );
      if (
        !hasContext &&
        (numericNoise(text, start, end) || epochNumber(match[0]))
      ) {
        continue;
      }
      const checked = checksum(match[0]);
      if (checked || hasContext || plausible?.(match[0])) {
        emit({
          start,
          end,
          type,
          category: 'personal',
          rule: 'national-format',
          confidence: nationalConfidence(
            hasContext,
            checked,
            plausible?.(match[0]) ||
              (checked && distinctiveShape(type, match[0]))
          ),
        });
      }
    }
  }
}
function nationalBoundary(text, start, end) {
  return !(
    /[\p{L}\p{N}_.+-]/u.test(text[start - 1] ?? '') ||
    /[\p{L}\p{N}_]/u.test(text[end] ?? '') ||
    /\d[ ()-]{0,3}$/.test(text.slice(Math.max(0, start - 4), start)) ||
    /^[ ()-]{0,3}\d/.test(text.slice(end, end + 4))
  );
}
function nationalConfidence(context, checked, plausible) {
  return context
    ? checked
      ? 0.99
      : 0.9
    : plausible
      ? checked
        ? 0.99
        : 0.4
      : 0.35;
}
