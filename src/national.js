import { numericNoise, epochNumber } from './confidence.js';
import * as checks from './national-checks.js';

const never = () => false;
const always = () => true;
// Each rule is data: `context` near the value, a `checksum` and a distinctive
// `plausible` shape raise confidence; `valid` (when present) must always hold.
// Callers may reuse or extend this list through `nationalRules`.
export const nationalRules = [
  {
    type: 'UK_NHS',
    pattern: /\d{3}[ -]?\d{3}[ -]?\d{4}/g,
    context: /\b(?:NHS|patient|healthcare|provider)\b/i,
    checksum: checks.nhs,
  },
  {
    type: 'KR_RRN',
    pattern: /\d{6}[ -]?[1-8]\d{6}/g,
    context: /\bRRN\b|주민등록/iu,
    checksum: checks.rrn,
    plausible: (v) => checks.datePart(checks.digitsOf(v)),
  },
  {
    type: 'IT_FISCAL_CODE',
    pattern:
      /[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]/g,
    context: /\bCF\b|codice fiscale/iu,
    checksum: checks.fiscalCode,
    plausible: always,
  },
  {
    type: 'SG_NRIC_FIN',
    pattern: /[STFGM]\d{7}[A-Z]/g,
    context: /\b(?:NRIC|FIN)\b/iu,
    checksum: checks.nric,
    plausible: always,
  },
  {
    type: 'PL_PESEL',
    pattern: /\d{11}/g,
    context: /\bPESEL\b/iu,
    checksum: checks.pesel,
  },
  {
    type: 'SE_PERSONNUMMER',
    pattern: /(?:\d{2})?\d{6}[-+]\d{4}/g,
    context: /personnummer/iu,
    checksum: checks.personnummer,
  },
  {
    type: 'ZA_ID_NUMBER',
    pattern: /\d{10}[0-2][89]\d/g,
    context: /\b(?:SA ID|RSA ID)\b|south african id/iu,
    checksum: checks.southAfricanId,
  },
  {
    type: 'AU_TFN',
    pattern: /\d{3}[ -]?\d{3}[ -]?\d{3}/g,
    context: /\bTFN\b|tax file number/iu,
    checksum: checks.tfn,
  },
  {
    type: 'CA_SIN',
    pattern: /\d{3}[ -]?\d{3}[ -]?\d{3}/g,
    context: /\b(?:SIN|NAS)\b|social insurance|assurance sociale/iu,
    checksum: checks.shortLuhn,
  },
  {
    type: 'RU_SNILS',
    pattern: /\d{3}[- ]\d{3}[- ]\d{3}[ -]\d{2}|\d{11}/g,
    context:
      /\bSNILS\b|снилс|пенсионное|страховое свидетельство|страховой номер/iu,
    checksum: checks.snils,
  },
  {
    type: 'RU_INN',
    pattern: /\d{12}|\d{10}/g,
    context: /\bINN\b|инн/iu,
    checksum: checks.inn,
  },
  {
    type: 'US_ITIN',
    pattern: /9\d{2}([- ]?)(?:5\d|6[0-5]|7\d|8[0-8]|9[0-2]|9[4-9])\1\d{4}/g,
    context: /\bITIN\b|taxpayer identification/iu,
    checksum: never,
    plausible: (v) => /^\d{3}-\d{2}-\d{4}$/.test(v),
  },
  {
    type: 'ABA_ROUTING_NUMBER',
    pattern: /\d{4}-?\d{4}-?\d/g,
    context: /\b(?:routing|ABA|RTN|transit)\b/iu,
    checksum: checks.abaRouting,
    valid: checks.abaRouting,
  },
  {
    type: 'US_BANK_NUMBER',
    pattern: /\d{8,17}/g,
    context:
      /\bbank\s+account\b|\b(?:account|acct)\.?\s*(?:number|num|no\.?|#)|\b(?:checking|savings)\s+account\b/iu,
    checksum: never,
  },
  {
    type: 'US_DRIVER_LICENSE',
    pattern: /[A-Z]{1,2}\d{4,14}|\d{7,14}/g,
    context: /\bdriver'?s?[ -]licen[cs]e\b|\bDLN?\b|\bD\.L\.(?=\s|$)/iu,
    checksum: never,
  },
  {
    type: 'UK_DRIVING_LICENCE',
    pattern: /[A-Z9]{5}\d[0156]\d{4}[A-Z9]{2}\d[A-Z]{2}/g,
    context: /\bdriv(?:ing|er'?s?)[ -]licen[cs]e\b|\bDVLA\b/iu,
    checksum: never,
    plausible: always,
  },
  {
    type: 'UK_NATIONAL_INSURANCE_NUMBER',
    pattern: /[A-Z]{2} ?\d{2} ?\d{2} ?\d{2} ?[A-D]/g,
    context: /\bNINO\b|national insurance|\bNI (?:number|no\b)/iu,
    checksum: never,
  },
  {
    type: 'ES_NIE',
    pattern: /[XYZ]-?\d{7}-?[A-Z]/g,
    context: /\bNIE\b|extranjero/iu,
    checksum: (v) => checks.spanishNie(v.replace(/-/g, '')),
    plausible: always,
  },
  {
    type: 'IT_VAT_CODE',
    pattern: /\d{11}/g,
    context: /partita\s+iva|\bP\.?\s?IVA\b|\bVAT\b/iu,
    checksum: checks.shortLuhn,
  },
  {
    type: 'AU_ABN',
    pattern: /\d{2} ?\d{3} ?\d{3} ?\d{3}/g,
    context: /\bABN\b|australian business number/iu,
    checksum: checks.abn,
    plausible: (v) => /^\d{2} \d{3} \d{3} \d{3}$/.test(v),
  },
  {
    type: 'AU_ACN',
    pattern: /\d{3} ?\d{3} ?\d{3}/g,
    context: /\bACN\b|australian company number/iu,
    checksum: checks.acn,
  },
  {
    type: 'AU_MEDICARE',
    pattern: /[2-6]\d{3} ?\d{5} ?\d(?:[ -/]?\d)?/g,
    context: /\bmedicare\b/iu,
    checksum: checks.medicare,
  },
  {
    type: 'IN_AADHAAR',
    pattern: /[2-9]\d{3}([ -]?)\d{4}\1\d{4}/g,
    context: /aadhaa?r|आधार|\bUIDAI\b/iu,
    checksum: checks.aadhaar,
  },
  {
    type: 'IN_GSTIN',
    pattern: /\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]/g,
    context: /\bGSTIN?\b|goods and services tax/iu,
    checksum: checks.gstin,
    plausible: always,
  },
  {
    type: 'IN_VOTER',
    pattern: /[A-Z]{3}\d{7}/g,
    context: /\bvoter\b|\bEPIC\b|election commission/iu,
    checksum: never,
  },
  {
    type: 'IN_PASSPORT',
    pattern: /[A-PR-WY][1-9]\d ?\d{4}[1-9]/g,
    context: /\bpassport\b/iu,
    checksum: never,
  },
  {
    type: 'FI_PERSONAL_IDENTITY_CODE',
    pattern: /\d{6}[-+A-FU-Y]\d{3}[0-9A-FHJ-NPR-Y]/g,
    context: /henkilötunnus|\bHETU\b|personal identity code|personbeteckning/iu,
    checksum: checks.finnishIdentityCode,
    plausible: always,
  },
  {
    type: 'TH_TNIN',
    pattern: /[1-8]\d{12}|[1-8]-\d{4}-\d{5}-\d{2}-\d/g,
    context: /\bthai\b|\bTNIN\b|เลขประจำตัวประชาชน|บัตรประชาชน/iu,
    checksum: checks.thaiId,
  },
  {
    type: 'MEDICAL_LICENSE',
    pattern: /[ABCDEFGHJKLMPRSTUX][A-Z9]\d{7}/g,
    context: /\bDEA\b|medical licen[cs]e|prescriber/iu,
    checksum: checks.dea,
  },
  {
    type: 'IMEI',
    pattern: /\d{15}|\d{2}-\d{6}-\d{6}-\d/g,
    context: /\bIMEI\b/iu,
    checksum: checks.shortLuhn,
  },
  {
    type: 'SWIFT_CODE',
    pattern: /[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?/g,
    context: /\b(?:SWIFT|BIC)\b/iu,
    checksum: never,
    valid: checks.swiftCode,
  },
  {
    type: 'VIN',
    pattern: /[A-HJ-NPR-Z\d]{17}/g,
    context: /\bVIN\b|vehicle identification|chassis/iu,
    checksum: checks.vin,
    valid: (v) => /\d/.test(v) && /[A-Z]/.test(v),
  },
  {
    type: 'UK_POSTCODE',
    pattern: /[A-Z]{1,2}\d[A-Z\d]? ?\d[ABD-HJLNP-UW-Z]{2}/g,
    context: /\bpost ?code\b|\bpostal code\b/iu,
    checksum: never,
  },
  {
    type: 'SG_UEN',
    pattern: /\d{8}[A-Z]|(?:19|20)\d{7}[A-Z]|[TSR]\d{2}[A-Z]{2}\d{4}[A-Z]/g,
    context: /\bUEN\b|unique entity number/iu,
    checksum: never,
  },
  {
    type: 'DE_TAX_ID',
    pattern: /[1-9]\d(?: ?\d{3}){3}|[1-9]\d{10}/g,
    context: /steuer[ -]?id|steueridentifikationsnummer|\bIdNr\b|\bTIN\b/iu,
    checksum: checks.germanTaxId,
  },
  {
    // EU VAT identification numbers by member-state prefix (VIES formats).
    type: 'EU_VAT_NUMBER',
    pattern:
      /(?:AT ?U\d{8}|BE ?[01]\d{9}|DE ?[1-9]\d{8}|DK ?\d{8}|EL ?\d{9}|ES ?[0-9A-Z]\d{7}[0-9A-Z]|FI ?\d{8}|FR ?[0-9A-HJ-NP-Z]{2}\d{9}|IE ?\d[0-9A-Z+*]\d{5}[A-Z]{1,2}|IT ?\d{11}|LU ?\d{8}|NL ?\d{9}B\d{2}|PL ?\d{10}|PT ?\d{9}|SE ?\d{12})/g,
    context:
      /\bVAT\b|\bUSt\b|USt-?Id|Umsatzsteuer|\bMwSt\b|\bTVA\b|\bBTW\b|\bIVA\b|\bALV\b|\bmoms\b|\bNIP\b|\bNIF\b/iu,
    checksum: checks.germanVat,
    plausible: (v) => /^(?:ATU|NL\d{9}B)/.test(v),
  },
  {
    type: 'AE_EMIRATES_ID',
    pattern: /784-?(?:19|20)\d{2}-?\d{7}-?\d/g,
    context: /emirates\s+id|\bEID\b|الهوية/iu,
    checksum: checks.emiratesId,
    plausible: (v) => /^784-\d{4}-\d{7}-\d$/.test(v),
  },
  {
    type: 'SA_NATIONAL_ID',
    pattern: /[12]\d{9}/g,
    context: /\biqama\b|saudi|national\s+id|رقم الهوية|الإقامة/iu,
    checksum: checks.saudiId,
  },
  {
    type: 'IL_ID_NUMBER',
    pattern: /\d{9}/g,
    context: /teudat\s+zehut|israeli\s+id|תעודת זהות|\bת\.ז\b/iu,
    checksum: checks.israeliId,
  },
  {
    type: 'STEAM_ID',
    pattern: /7656119\d{10}/g,
    context: /\bsteam/iu,
    checksum: never,
  },
  {
    type: 'TRACKING_NUMBER',
    pattern: /1Z[0-9A-Z]{15}\d|9[2-5]\d{2}(?: ?\d{4}){4}(?: ?\d{2})?/g,
    context: /tracking|\bUPS\b|\bUSPS\b|shipment|parcel/iu,
    checksum: checks.upsTracking,
    plausible: (v) => v.startsWith('1Z'),
  },
];
function distinctiveShape(type, value) {
  return (
    (type === 'RU_SNILS' && /^\d{3}([- ])\d{3}\1\d{3} \d{2}$/.test(value)) ||
    (type === 'RU_INN' && value.length === 12)
  );
}
export function detectNational(text, emit, rules = nationalRules) {
  for (const rule of rules) {
    for (const match of text.matchAll(rule.pattern)) {
      const confidence = nationalMatch(text, rule, match);
      if (confidence !== undefined) {
        emit({
          start: match.index,
          end: match.index + match[0].length,
          type: rule.type,
          category: 'personal',
          rule: 'national-format',
          confidence,
        });
      }
    }
  }
}
// Confidence for one candidate, or undefined when it is not an identifier.
function nationalMatch(text, rule, match) {
  const value = match[0],
    start = match.index,
    end = start + value.length;
  if (!nationalBoundary(text, start, end) || rule.valid?.(value) === false) {
    return undefined;
  }
  const hasContext = rule.context.test(
    text.slice(Math.max(0, start - 64), end + 32)
  );
  if (!hasContext && (numericNoise(text, start) || epochNumber(value))) {
    return undefined;
  }
  const checked = rule.checksum(value),
    plausible = rule.plausible?.(value);
  return checked || hasContext || plausible
    ? nationalConfidence(
        hasContext,
        checked,
        plausible || (checked && distinctiveShape(rule.type, value))
      )
    : undefined;
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
