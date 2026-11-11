import { catalogTypes } from './entities.js';
import { escapePattern, failure } from './detection.js';
import { jsonStringLiterals } from './json-string-runs.js';
import { placeholderToken, validatePlaceholderFormat } from './restore-map.js';

// Native types that the shared vendor-label catalog does not already list. The
// national identifier types are spelled out here so that this module does not
// load the national rules.
const nativeTypes = [
  'ABA_ROUTING_NUMBER',
  'ADDRESS',
  'AE_EMIRATES_ID',
  'AGE',
  'AU_ABN',
  'AU_ACN',
  'AU_MEDICARE',
  'AU_TFN',
  'BRAZIL_CPF_NUMBER',
  'CA_SIN',
  'CREDENTIAL',
  'CREDIT_CARD',
  'DATE',
  'DE_TAX_ID',
  'EDUCATION',
  'EMAIL',
  'ENCODED_SENSITIVE',
  'ES_NIE',
  'EU_VAT_NUMBER',
  'FI_PERSONAL_IDENTITY_CODE',
  'GENDER',
  'IBAN',
  'ID',
  'IL_ID_NUMBER',
  'IMEI',
  'IN_AADHAAR',
  'IN_GSTIN',
  'IN_PASSPORT',
  'IN_VOTER',
  'IP_ADDRESS',
  'IT_FISCAL_CODE',
  'IT_VAT_CODE',
  'KR_RRN',
  'LOCATION',
  'MAC_ADDRESS',
  'MEDICAL_LICENSE',
  'ORGANIZATION',
  'PASSPORT_MRZ',
  'PASSPORT_NUMBER',
  'PERSON',
  'PERSONAL_ATTRIBUTE',
  'PHONE',
  'PL_PESEL',
  'POSTAL_CODE',
  'PRIVATE_KEY',
  'PROPER_NAME',
  'RU_INN',
  'RU_SNILS',
  'SA_NATIONAL_ID',
  'SENSITIVE',
  'SE_PERSONNUMMER',
  'SG_NRIC_FIN',
  'SG_UEN',
  'STATE',
  'STEAM_ID',
  'SWIFT_CODE',
  'TH_TNIN',
  'TRACKING_NUMBER',
  'UK_DRIVING_LICENCE',
  'UK_NATIONAL_INSURANCE_NUMBER',
  'UK_NHS',
  'UK_POSTCODE',
  'URL',
  'USERNAME',
  'US_BANK_NUMBER',
  'US_DRIVER_LICENSE',
  'US_HEALTHCARE_NPI',
  'US_ITIN',
  'VIN',
  'ZA_ID_NUMBER',
];
let reserved;
// Every type that a built-in rule can turn into a `Type-n` token.
export function reservedPlaceholderTypes() {
  reserved ??= Object.freeze(
    [...new Set([...catalogTypes(), ...nativeTypes])].sort()
  );
  return reserved;
}

const defaultFormat = '{Type}-{n}';
const patterns = new Map();
const patternCacheSize = 64;
// The namespace pattern depends only on the format and on the types beyond the
// reserved list, so it is compiled once per format and cached.
export function namespacePattern(format = defaultFormat, extraTypes = []) {
  const base = new Set(reservedPlaceholderTypes());
  const extra = [...new Set(extraTypes)].filter((type) => !base.has(type));
  const key = `${format}\0${extra.sort().join('\0')}`;
  const cached = patterns.get(key);
  if (cached) {
    return cached;
  }
  const [before, after] = format.split('{n}');
  const typed = before.match(/\{(?:Type|TYPE|type)\}/) ? before : after;
  const types = new Map();
  for (const type of [...base, ...extra]) {
    const part = placeholderToken(type, 1, typed);
    types.set(part, [...(types.get(part) ?? []), type]);
  }
  const alternation = [...types.keys()]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map(escapePattern)
    .join('|');
  const number = '([1-9][0-9]*)';
  const source =
    typed === before
      ? `(${alternation})${number}${escapePattern(after)}`
      : `${escapePattern(before)}${number}(${alternation})`;
  const pattern = {
    source: `(?<![\\p{L}\\p{M}\\p{N}_])(?:${source})(?![\\p{L}\\p{M}\\p{N}_])`,
    typedFirst: typed === before,
    types,
  };
  if (patterns.size >= patternCacheSize) {
    patterns.delete(patterns.keys().next().value);
  }
  patterns.set(key, pattern);
  return pattern;
}
// Tokens of the namespace with the types each spelling can stand for.
export function placeholderTokens(text, pattern) {
  const tokens = [];
  if (!/[1-9]/u.test(text)) {
    return tokens;
  }
  for (const match of text.matchAll(new RegExp(pattern.source, 'gu'))) {
    const [part, number] = pattern.typedFirst
      ? [match[1], match[2]]
      : [match[2], match[1]];
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      number: Number(number),
      types: pattern.types.get(part),
    });
  }
  return tokens;
}
export function containsPlaceholder(text, pattern) {
  return /[1-9]/u.test(text) && new RegExp(pattern.source, 'u').test(text);
}
// Tokens spelled with JSON escapes inside string literals, such as
// `Person-1`, decoded so that they cannot hide from the namespace check.
export function escapedPlaceholderTokens(text, pattern) {
  const tokens = [];
  // Without an escape every literal has already been checked in the raw text.
  if (!text.includes('\\')) {
    return tokens;
  }
  for (const literal of jsonStringLiterals(text)) {
    if (!literal.includes('\\')) {
      continue;
    }
    try {
      tokens.push(...placeholderTokens(JSON.parse(literal), pattern));
    } catch {
      // Ordinary free text may include strings that are not JSON literals.
    }
  }
  return tokens;
}

// Public check for a whole `Type-n` token of the library namespace.
export function isPlaceholderToken(text, options = {}) {
  if (
    options === null ||
    typeof options !== 'object' ||
    (options.types !== undefined &&
      (!Array.isArray(options.types) ||
        options.types.some(
          (type) =>
            typeof type !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/.test(type)
        )))
  ) {
    throw failure('ERR_CONFIG');
  }
  if (typeof text !== 'string') {
    return false;
  }
  const pattern = namespacePattern(
    validatePlaceholderFormat(options.format ?? defaultFormat),
    options.types ?? []
  );
  return new RegExp(`^(?:${pattern.source})$`, 'u').test(text);
}
