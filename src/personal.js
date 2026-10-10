import { collectMatches, escapePattern } from './detection.js';
import { firstNames } from './names.js';
import { labels } from './rules.js';
import { transliteratedGivenNames } from './transliteration.js';
const labelWords = new Set(Object.values(labels).flat());

const details = (type, rule, confidence = 0.85) => ({
  type,
  rule,
  category: 'personal',
  confidence,
});
const names = Object.entries(firstNames).map(([language, list]) => {
  const words = list.split(' ').map(escapePattern).join('|');
  const surname = ['ar', 'he', 'hi', 'th'].includes(language)
    ? '[\\p{L}\\p{M}]{2,32}'
    : "[\\p{Lu}][\\p{L}\\p{M}’'-]{1,32}";
  const pattern = ['ja', 'zh', 'ko'].includes(language)
    ? `(?:${words})[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}]{1,4}`
    : `(?:${words})[ \\t]+${surname}${language === 'vi' ? `(?:[ \\t]+${surname})?` : ''}`;
  return new RegExp(`(?<![\\p{L}\\p{M}])${pattern}(?![\\p{L}\\p{M}])`, 'gu');
});

// ISO 13616 national lengths; checksum arithmetic never exceeds 3 digits.
const ibanLengths = Object.fromEntries(
  'AD24 AE23 AL28 AT20 AZ28 BA20 BE16 BG22 BH22 BI27 BR29 BY28 CH21 CR22 CY28 CZ24 DE22 DJ27 DK18 DO28 EE20 EG29 ES24 FI18 FK18 FO18 FR27 GB22 GE22 GI23 GL18 GR27 GT28 HR21 HU28 IE22 IL23 IQ23 IS26 IT27 JO30 KW30 KZ20 LB28 LC32 LI21 LT20 LU20 LV21 LY25 MC27 MD24 ME22 MK19 MN20 MR27 MT31 MU30 NI28 NL18 NO15 OM23 PK24 PL28 PS29 PT25 QA29 RO24 RS22 RU33 SA24 SC31 SD18 SE24 SI19 SK24 SM27 SO23 ST25 SV28 TL23 TN24 TR26 UA29 VA22 VG24 XK20'
    .split(' ')
    .map((entry) => [entry.slice(0, 2), Number(entry.slice(2))])
);

export function iban(value) {
  const compact = value.replace(/\s/g, '').toUpperCase();
  if (
    !/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(compact) ||
    compact.length !== ibanLengths[compact.slice(0, 2)]
  ) {
    return false;
  }
  const rotated = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (const char of rotated) {
    const digits = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

function detectIban(text, emit) {
  for (const match of text.matchAll(
    /(?<![A-Z0-9])[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){8,40}/g
  )) {
    const needed = ibanLengths[match[0].slice(0, 2)];
    if (!needed) {
      continue;
    }
    let end = 0,
      count = 0;
    while (end < match[0].length && count < needed) {
      if (match[0][end] !== ' ') {
        count++;
      }
      end++;
    }
    const value = match[0].slice(0, end);
    if (iban(value)) {
      emit({
        start: match.index,
        end: match.index + end,
        ...details('IBAN', 'iban-checksum', 0.99),
      });
    }
  }
}

const latinGiven = Object.entries(firstNames)
  .filter(([locale]) =>
    ['en', 'es', 'fr', 'de', 'pt', 'ruLatn', 'tr'].includes(locale)
  )
  .flatMap(([, list]) => list.split(' '))
  .concat(transliteratedGivenNames)
  .map(escapePattern)
  .join('|');
const slavicSurname =
  '[\\p{L}]{2,28}(?:ova|eva|ov|ev|in|ina|enko|sky|ski|skaya)';
const latinPairs = new RegExp(
  `(?<![\\p{L}\\p{M}])(?:${latinGiven})[ \\t]+(?:${slavicSurname}|Smith|Jones|Brown|Roe|Doe)(?![\\p{L}\\p{M}])`,
  'giu'
);
const shapedName = '[\\p{Lu}][\\p{L}\\p{M}]{1,31}';
const suffixes =
  'ova eva ov ev in ina enko sky ski skaya ова ева ов ев ин ина енко ский ская'
    .split(' ')
    .map((s) => [...s].map((c) => `[${c}${c.toUpperCase()}]`).join(''))
    .join('|');
const shapedSurname = `[\\p{Lu}][\\p{L}]{1,28}(?:${suffixes})`;
const slavicPairs = new RegExp(
  `(?<![\\p{L}\\p{M}])(?:${shapedName}[ \\t]+${shapedSurname}|${shapedSurname}[ \\t]+${shapedName})(?![\\p{L}\\p{M}])`,
  'gu'
);
const documentWord =
  /^(?:PASSPORT|VISA|ID|PHOTO|SCAN|ПАСПОРТ|ВИЗА|СКАН|ФОТО)$/iu;
const placeWord = /^(?:Bay|Sands|Hotel|Street|Road|Avenue)$/iu;
function detectDocumentNames(text, emit) {
  for (const match of text.matchAll(
    /(?<![\p{L}\p{N}_-])[\p{L}]{2,32}(?:[_-][\p{L}]{2,32}){1,12}(?![\p{L}\p{N}_-])/gu
  )) {
    // Field names such as NATIONAL_ID identify the label, not its value.
    if (
      /^[ \t]*(?:["'][ \t]*)?[:=：]/.test(
        text.slice(match.index + match[0].length)
      )
    ) {
      continue;
    }
    const tokens = [...match[0].matchAll(/\p{L}+/gu)];
    for (let i = 0; i < tokens.length; i++) {
      if (!documentWord.test(tokens[i][0])) {
        continue;
      }
      for (const step of [-1, 1]) {
        const candidates = [];
        for (
          let j = i + step;
          j >= 0 && j < tokens.length && candidates.length < 4;
          j += step
        ) {
          if (documentWord.test(tokens[j][0])) {
            break;
          }
          candidates.push(tokens[j]);
        }
        if (candidates.length < 2 || candidates.length > 3) {
          continue;
        }
        candidates.sort((a, b) => a.index - b.index);
        emit({
          start: match.index + candidates[0].index,
          end:
            match.index + candidates.at(-1).index + candidates.at(-1)[0].length,
          ...details('PERSON', 'name-document', 0.9),
        });
      }
    }
  }
}
const russianFull =
  /(?<![\p{L}])(?:[А-ЯЁ][а-яё]{2,30}[ \t]+){2}[А-ЯЁ][а-яё]{2,30}(?:вич|вна|ична)|(?<![\p{L}])(?:[А-ЯЁ][а-яё]{2,30}[ \t]+){2}(?:оглы|кызы)(?![\p{L}])/gu;
export function detectPersonal(text, emit) {
  detectDocumentNames(text, emit);
  for (const pattern of [latinPairs, slavicPairs, russianFull]) {
    collectMatches(
      text,
      pattern,
      emit,
      details('PERSON', 'name-identity', 0.9),
      0,
      (value) => !placeWord.test(value.split(/[ \t]+/).at(-1))
    );
  }
  for (const pattern of names) {
    collectMatches(
      text,
      pattern,
      emit,
      details('PERSON', 'name-gazetteer', 0.7),
      0,
      (value) =>
        !labelWords.has(value) && !placeWord.test(value.split(/[ \t]+/).at(-1))
    );
  }
  collectMatches(
    text,
    /(?:компании|организации|company|organization|société|empresa|Firma)[ \t]+([\p{Lu}][\p{L}\p{M}&'-]{1,80})/gu,
    emit,
    details('ORGANIZATION', 'organization-context', 0.7),
    1
  );
  collectMatches(
    text,
    /(?<![\d(])(?:[78][ -]?)?\(\d{3}\)[ -]?\d{3}[ -]\d{2}[ -]?\d{2}(?!\d)|(?<!\d)(?:\d{3}[.-]){2}\d{4}(?!\d)/g,
    emit,
    details('PHONE', 'national-phone')
  );
  collectMatches(
    text,
    /(?<![\p{L}\p{N}])\d{1,6}[A-Za-z]?[ \t]+(?:[\p{Lu}][\p{L}.'-]*[ \t]+){1,5}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd|Way|Straße|Strasse|Rue|Calle|Rua)\b(?:,[ \t]+(?:[^\r\n<>]{1,80}?[ \t]+(?:[A-Z]{1,2}\d[A-Z\d]?[ \t]+\d[A-Z]{2}|\d{5}(?:-\d{4})?)\b|(?:[\p{Lu}][\p{Ll}.'-]+[ \t]*){1,4}))?/gu,
    emit,
    details('ADDRESS', 'postal-address')
  );
  collectMatches(
    text,
    /(?<![\da-fA-F:.-])(?:[\da-fA-F]{2}[:-]){5}[\da-fA-F]{2}(?![\da-fA-F:.-])/g,
    emit,
    details('MAC_ADDRESS', 'mac')
  );
  collectMatches(
    text,
    /(?<![\p{L}\p{N}_.\]])@[\p{L}\p{N}_]{2,32}(?![\p{L}\p{N}_.])/gu,
    emit,
    details('USERNAME', 'messenger-handle', 0.65)
  );
  collectMatches(
    text,
    /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)([^/\\\s"'<>[\]]+)/g,
    emit,
    details('USERNAME', 'home-path', 0.95),
    1
  );
  detectIban(text, emit);
}
