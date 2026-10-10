import { collectMatches } from './detection.js';

export const identityTypes = new Set([
  'SSN',
  'US_SSN',
  'BRAZIL_CPF_NUMBER',
  'INDIA_PAN_INDIVIDUAL',
  'UK_NATIONAL_INSURANCE_NUMBER',
  'SPAIN_DNI_NUMBER',
  'US_HEALTHCARE_NPI',
  'DRIVER_LICENSE',
  'DRIVERS_LICENSE',
  'NATIONAL_ID',
  'CHINA_RESIDENT_ID_NUMBER',
  'HONG_KONG_ID_NUMBER',
  'SOUTH_AFRICA_ID_NUMBER',
  'TAIWAN_ID_NUMBER',
  'TURKEY_ID_NUMBER',
  'GOVERNMENT_ID',
  'DOD_ID_NUMBER',
  'JAPAN_INDIVIDUAL_NUMBER',
  'INDIA_GST_INDIVIDUAL',
  'US_MEDICARE_BENEFICIARY_ID_NUMBER',
  'ID',
  'PASSPORT_NUMBER',
  'PASSPORT_MRZ',
  'BOOKING_REFERENCE',
  'TICKET_NUMBER',
  'VISA_NUMBER',
  'UK_NHS',
  'KR_RRN',
  'IT_FISCAL_CODE',
  'SG_NRIC_FIN',
  'PL_PESEL',
  'SE_PERSONNUMMER',
  'ZA_ID_NUMBER',
  'AU_TFN',
  'CA_SIN',
  'RU_SNILS',
  'RU_INN',
]);
export function isIdentityType(type) {
  return (
    identityTypes.has(type) ||
    /PASSPORT|(?:DRIVERS?|DRIVING)_?LICENSE|IDENTITY|NATIONAL_?(?:ID|IDENTIFICATION)|PERSONAL_?(?:ID|IDENTIFICATION)|UNIQUE_?IDENTIFICATION|SOCIAL_?(?:SECURITY|INSURANCE|IDENTIFICATION)|RESIDENT_?REGISTRATION|(?:TAX|TAXPAYER).*?(?:IDENTIFICATION|NUMBER|REFERENCE)|AADHAAR|FISCAL_CODE|PESEL|RRN|NHS|SNILS|INN_NUMBER/.test(
      type
    )
  );
}
const personal = (type, rule, confidence = 0.85) => ({
  type,
  rule,
  category: 'personal',
  confidence,
});
const passportContext =
  /(?<![\p{L}\p{N}_])(?:passports?|series and number|document number|паспорт[\p{L}]*|загран[\p{L}]*|серия|номер|pasaporte|Reisepass|passeport|passaporto|护照|パスポート)(?![\p{L}\p{N}_])/iu;

export function mrzCheck(value) {
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    const digit =
      char === '<'
        ? 0
        : /\d/.test(char)
          ? Number(char)
          : char.charCodeAt(0) - 55;
    sum += digit * [7, 3, 1][i % 3];
  }
  return String(sum % 10);
}
function mrzConfidence(value) {
  const compact = value.replace(/[ \t\r\n]/g, '');
  const match =
    /^([A-Z0-9<]{9})([\d<])[A-Z<]{3}(\d{6})(\d)[MF<](\d{6})([\d<])/.exec(
      compact
    );
  if (match) {
    return mrzCheck(match[1]) === match[2] &&
      mrzCheck(match[3]) === match[4] &&
      mrzCheck(match[5]) === match[6]
      ? 0.99
      : 0.85;
  }
  const td1Header = /^[IAC][A-Z<][A-Z<]{3}([A-Z0-9<]{9})([\d<])/.exec(compact);
  if (td1Header) {
    return mrzCheck(td1Header[1]) === td1Header[2] ? 0.99 : 0.85;
  }
  const td1Data = /^([\d<]{6})(\d)[MF<]([\d<]{6})(\d)[A-Z<]{3}/.exec(compact);
  return td1Data &&
    mrzCheck(td1Data[1]) === td1Data[2] &&
    mrzCheck(td1Data[3]) === td1Data[4]
    ? 0.99
    : 0.85;
}
function detectMrz(text, emit) {
  // Each candidate has a finite span. Checks improve confidence, never gate
  // redaction: OCR damage and truncated personal data remain sensitive.
  const patterns = [
    /(?<![A-Za-z0-9_])[PIACV][A-Z<][ \t\r\n]{0,4}[A-Z<]{3}[ \t\r\n]{0,4}[A-Z0-9<][A-Z0-9< \t\r\n]{8,100}/g,
    /(?<![A-Za-z0-9_])[A-Z]{2,30}<<[A-Z< \t\r\n]{2,72}/g,
    /(?<![A-Za-z0-9_])[A-Z0-9<]{9}[\d<][ \t\r\n]{0,4}[A-Z<]{3}[ \t\r\n]{0,4}[\d<]{6}[\d<][ \t\r\n]{0,4}[MF<][ \t\r\n]{0,4}[\d<]{6}[\d<][A-Z0-9< \t\r\n]{0,40}/g,
    /(?<![A-Za-z0-9_])[\d<]{6}[\d<][ \t\r\n]{0,4}[MF<][ \t\r\n]{0,4}[\d<]{6}[\d<][ \t\r\n]{0,4}[A-Z<]{3}[A-Z0-9< \t\r\n]{4,20}/g,
    /(?<![A-Za-z0-9_])[A-Z0-9<]{9}[\d<][ \t\r\n]{0,4}[A-Z<]{3}[ \t\r\n]{0,4}\d{6}(?:\d[ \t\r\n]{0,4}[MF<](?:[ \t\r\n]{0,4}[\d<]{1,7})?)?/g,
  ];
  patterns.forEach((pattern, index) => {
    for (const match of text.matchAll(pattern)) {
      const value = (
          /[a-z]/.test(text[match.index + match[0].length] ?? '')
            ? match[0].replace(/(?:[ \t\r\n]+)[A-Z]{1,6}$/, '')
            : match[0]
        ).trimEnd(),
        compact = value.replace(/[ \t\r\n]/g, '');
      const validShape =
        index === 0
          ? /^[PIACV][A-Z<][A-Z<]{3}(?:[A-Z]{2,}<<[A-Z<]+|[A-Z0-9<]{9}[\d<]<{2,})/.test(
              compact
            )
          : index === 1
            ? /^[A-Z]{2,}<<[A-Z]+</.test(compact)
            : index === 3
              ? /\d/.test(compact.slice(0, 7))
              : /[A-Z0-9]/.test(compact.slice(0, 9));
      if (validShape) {
        emit({
          start: match.index,
          end: match.index + value.length,
          ...personal('PASSPORT_MRZ', 'mrz', mrzConfidence(value)),
        });
      }
    }
  });
}
function numericNeighbour(text, start, end) {
  return (
    /\d[ ()+.-]{0,4}$/.test(text.slice(Math.max(0, start - 5), start)) ||
    /^[ ()+.-]{0,4}\d/.test(text.slice(end, end + 5))
  );
}
function detectPassports(text, emit) {
  const patterns = [
    /(?<![\p{L}\p{N}_])(?:\d{2}[ -]\d{2}[ -]\d{6}|\d{4}[ -]\d{6}|\d{2}[ -]\d{7})(?![\p{L}\p{N}_])/gu,
    /(?<![\p{L}\p{N}_])(?:\d{9}|[CFGHJK][0-9CFGHJKLMNPRTVWXYZ]{8}|[A-Z]\d{7}|M\d{3}[A-Z]\d{4}|[A-Z]{2}\d{7})(?![\p{L}\p{N}_])/gu,
    /(?<![\p{L}\p{N}_])[A-Z0-9<]{9}\d(?![\p{L}\p{N}_])/gu,
  ];
  patterns.forEach((pattern, index) => {
    for (const match of text.matchAll(pattern)) {
      const value = match[0],
        start = match.index,
        end = start + value.length;
      const context = text.slice(
        Math.max(0, start - 80),
        Math.min(text.length, end + 80)
      );
      const checked =
        index === 2 &&
        /[A-Z]/.test(value) &&
        mrzCheck(value.slice(0, 9)) === value[9];
      if ((index === 2 && !checked) || numericNeighbour(text, start, end)) {
        continue;
      }
      if (
        /^\d+$/.test(value) &&
        /(?:timestamp|epoch|version|commit|thread|call)[ :=_-]*$/i.test(
          text.slice(Math.max(0, start - 24), start)
        )
      ) {
        continue;
      }
      emit({
        start,
        end,
        ...personal(
          'PASSPORT_NUMBER',
          'passport-format',
          checked ? 0.99 : passportContext.test(context) ? 0.9 : 0.4
        ),
      });
    }
  });
}
const booking =
  /(?<![\p{L}\p{N}_])(?:booking(?:[ _-]+(?:reference|code))?|reservation(?:[ _-]+code)?|confirmation(?:[ _-]+code)?|бронь|record[ _-]+locator|PNR|код брони|номер брони|бронирование)[ \t]*[:=：]?[ \t]*[`"']?([A-Z0-9]{4,8})(?![\p{L}\p{N}_])/giu;
const ticket =
  /(?<![\p{L}\p{N}_])(?:e[ -]?ticket|ticket[ _-]*(?:number|no)?|номер билета|электронный билет)[ \t]*[:=：]?[ \t]*[`"']?(\d{3}[ -]?\d{10})(?![\p{L}\p{N}_])/giu;
const visa =
  /(?<![\p{L}\p{N}_])(?:e[ -]?visa|visa|номер визы|виза)(?:[ \t_-]+(?:registration|application|number|no|code|номер|код)){0,3}[ \t]*[:=：]?[ \t]*[`"']?([A-Z0-9][A-Z0-9-]{4,31})(?![\p{L}\p{N}_])/giu;
const placeholder =
  /^(?:NONE|UNKNOWN|NULL|UNDEFINED|REDACTED|EXAMPLE|SAMPLE|PENDING|HOTEL|BOOKING|REFERENCE|REGISTRATION|APPLICATION|NUMBER|CODE|FAILED|ERROR|HTTP|OK|CANCELLED|CONFIRMED|SUCCESS|READY|ACTIVE|CLOSED)$/i;
function detectTravel(text, emit) {
  collectMatches(
    text,
    booking,
    emit,
    personal('BOOKING_REFERENCE', 'booking-context'),
    1,
    (v) => !placeholder.test(v) && (v === v.toUpperCase() || /\d/.test(v))
  );
  collectMatches(
    text,
    /(?:AirIndia|Air-?India|AirFrance|BritishAirways|Lufthansa|Emirates|Qatar|Delta|United|Ryanair|Aeroflot|Аэрофлот)[-_]([A-Z0-9]{5,8})(?=[-_.])/g,
    emit,
    personal('BOOKING_REFERENCE', 'booking-filename', 0.9),
    1,
    (v) => !placeholder.test(v)
  );
  collectMatches(
    text,
    ticket,
    emit,
    personal('TICKET_NUMBER', 'ticket-context'),
    1
  );
  collectMatches(
    text,
    visa,
    emit,
    personal('VISA_NUMBER', 'visa-context'),
    1,
    (v) => !placeholder.test(v) && /\d/.test(v)
  );
}

export function detectIdentity(text, emit) {
  detectMrz(text, emit);
  detectPassports(text, emit);
  detectTravel(text, emit);
}

export function fakeIdentityValue(value, type, options) {
  if (!isIdentityType(type)) {
    return false;
  }
  if (options.fakeValues?.includes(value)) {
    return true;
  }
  if (options.fakeIdentity !== 'specimen-and-synthetic') {
    return false;
  }
  const compact = value.replace(/\s/g, '').toUpperCase();
  if (/^(?:SPECIMEN|ОБРАЗЕЦ|MUSTERMANN)$/.test(compact)) {
    return true;
  }
  if (type === 'PASSPORT_MRZ') {
    if (
      /^[PIACV][A-Z<]UTO/.test(compact) ||
      /^(?:UTO)?ERIKSSON<<ANNA<MARIA</.test(compact) ||
      /^L898902C3[\d<]UTO/.test(compact) ||
      /^[\d<]{7}[MF<][\d<]{7}UTO/.test(compact)
    ) {
      return true;
    }
    const document = /^[PIACV][A-Z<][A-Z<]{3}/.test(compact)
      ? compact.slice(5, 14)
      : compact.slice(0, 9);
    return (
      /^(?:C01X00T47|T22000129)$/.test(document) || syntheticDocument(document)
    );
  }
  return (
    /^(?:L898902C3(?:6)?|D23145890(?:7)?|C01X00T47|T22000129)$/.test(compact) ||
    syntheticDocument(compact)
  );
}
function syntheticDocument(value) {
  const digits = value.replace(/[ \t-]/g, '');
  return (
    (digits.length >= 5 && /^(\d)\1+$/.test(digits)) ||
    /012345|123456|234567|345678|456789|987654|876543|765432|654321|543210/.test(
      digits
    )
  );
}
