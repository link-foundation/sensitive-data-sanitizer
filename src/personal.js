import { collectMatches, escapePattern } from './detection.js';
import { firstNames } from './names.js';
import { labels } from './rules.js';
import { transliteratedGivenNames } from './transliteration.js';
import { serviceAccounts } from './public.js';
import { isCommonProseWord } from './prose-words.js';
import { flatRegExp, unicodeRun } from './unicode-runs.js';
const labelWords = new Set(Object.values(labels).flat());

const details = (type, rule, confidence = 0.85) => ({
  type,
  rule,
  category: 'personal',
  confidence,
});
// "John C Smith", "John A. Smith": a Latin-script middle initial. A bare "I"
// is the pronoun ("Will I Go"), so it needs its period.
const initial = (language) =>
  ['ar', 'he', 'hi', 'th', 'ja', 'zh', 'ko'].includes(language)
    ? ''
    : '(?:[ \\t]+(?:\\p{Lu}\\.|(?!I[ \\t])\\p{Lu}(?=[ \\t])))?';
const names = Object.entries(firstNames).map(([language, list]) => {
  const words = list.split(' ').map(escapePattern).join('|');
  const surname = ['ar', 'he', 'hi', 'th'].includes(language)
    ? '[\\p{L}\\p{M}]{2,32}'
    : "[\\p{Lu}][\\p{L}\\p{M}’'-]{1,32}";
  const pattern = ['ja', 'zh', 'ko'].includes(language)
    ? `(?:${words})[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}]{1,4}`
    : `(?:${words})${initial(language)}[ \\t]+${surname}${language === 'vi' ? `(?:[ \\t]+${surname})?` : ''}`;
  return new RegExp(`(?<![\\p{L}\\p{M}])${pattern}(?![\\p{L}\\p{M}])`, 'gu');
});

// ISO 13616 national lengths; checksum arithmetic never exceeds 3 digits.
const ibanLengths = Object.fromEntries(
  'AD24 AE23 AL28 AT20 AZ28 BA20 BE16 BG22 BH22 BI27 BR29 BY28 CH21 CR22 CY28 CZ24 DE22 DJ27 DK18 DO28 EE20 EG29 ES24 FI18 FK18 FO18 FR27 GB22 GE22 GI23 GL18 GR27 GT28 HR21 HU28 IE22 IL23 IQ23 IS26 IT27 JO30 KW30 KZ20 LB28 LC32 LI21 LT20 LU20 LV21 LY25 MC27 MD24 ME22 MK19 MN20 MR27 MT31 MU30 NI28 NL18 NO15 OM23 PK24 PL28 PS29 PT25 QA29 RO24 RS22 RU33 SA24 SC31 SD18 SE24 SI19 SK24 SM27 SO23 ST25 SV28 TL23 TN24 TR26 UA29 VA22 VG24 XK20'
    .split(' ')
    .map((entry) => [entry.slice(0, 2), Number(entry.slice(2))])
);

// `@handle/jane@example.com` is a mention and an address, not a package path.
// The local part is a `unicodeRun`, flat on two-byte strings (#172).
const mentionedEmail = new RegExp(
  `^/${unicodeRun("[\\p{L}\\p{N}_.!#$%&'*+?^`{|}~-]")}@[\\p{L}\\p{N}][\\p{L}\\p{N}.-]{0,252}\\.\\p{L}{2,63}(?![\\p{L}\\p{N}_-])`,
  'u'
);
export function iban(value) {
  const compact = value.replace(/[\s-]/g, '').toUpperCase();
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
    /(?<![A-Z0-9])[A-Z]{2} ?\d{2}(?:[ -]?[A-Z0-9]){8,40}/g
  )) {
    const needed = ibanLengths[match[0].slice(0, 2)];
    if (!needed) {
      continue;
    }
    let end = 0,
      count = 0;
    while (end < match[0].length && count < needed) {
      if (!/[ -]/.test(match[0][end])) {
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
const givenWords = new Set(
  Object.values(firstNames)
    .flatMap((list) => list.toLowerCase().split(' '))
    .concat(transliteratedGivenNames.map((name) => name.toLowerCase()))
);
const capitalizedToken = flatRegExp(
  /^(?:\p{Lu}\p{Ll}[\p{L}\p{M}]*|\p{Lu}{2,32})$/u
);
function nameShaped(candidates) {
  return (
    candidates.some((token) => givenWords.has(token[0].toLowerCase())) ||
    candidates.every((token) => capitalizedToken.test(token[0]))
  );
}
function documentReference(text, match) {
  const following = text.slice(
    match.index + match[0].length,
    match.index + match[0].length + 16
  );
  return (
    /^\.[a-z\d]{1,10}(?![\p{L}\p{N}_])/iu.test(following) ||
    /[/\\]/.test(text[match.index - 1] ?? '')
  );
}
function detectDocumentNames(text, emit) {
  for (const match of text.matchAll(
    /(?<![\p{L}\p{N}_-])[\p{L}]{2,32}(?:[_-][\p{L}]{2,32}){1,12}(?![\p{L}\p{N}_-])/gu
  )) {
    if (!documentReference(text, match)) {
      continue;
    }
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
        if (!nameShaped(candidates)) {
          continue;
        }
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
// "My ITIN", "Our BIN": a possessive word or a short all-capital acronym
// matches the Slavic surname shape but carries no name evidence.
const possessiveWord =
  /^(?:my|our|your|his|her|their|its|the|this|that|мой|моя|наш|наша|ваш|ваша)$/iu;
function slavicPairEvidence(value) {
  const words = value.split(/[ \t]+/);
  return !words.some(
    (word) =>
      possessiveWord.test(word) ||
      /^\p{Lu}{2,4}$/u.test(word) ||
      isCommonProseWord(word)
  );
}
// A rejected pair is retried from its second word, so `Кандидат Петров Иван`
// still finds `Петров Иван` after the cue word.
function detectSlavicPairs(text, emit) {
  const pattern = new RegExp(slavicPairs.source, 'gu');
  let match;
  while ((match = pattern.exec(text))) {
    const value = match[0];
    if (
      value !== 'REDACTED' &&
      !placeWord.test(value.split(/[ \t]+/).at(-1)) &&
      slavicPairEvidence(value)
    ) {
      emit({
        start: match.index,
        end: match.index + value.length,
        ...details('PERSON', 'name-identity', 0.9),
      });
    } else {
      pattern.lastIndex = match.index + value.search(/[ \t]/u) + 1;
    }
  }
}
export function detectPersonal(text, emit) {
  detectDocumentNames(text, emit);
  detectSlavicPairs(text, emit);
  for (const pattern of [
    latinPairs,
    russianFull,
    /(?<![\p{L}])(?:[А-ЯЁ][а-яё]{2,30}[ \t]+)[А-ЯЁ][а-яё]{2,30}(?:вич|вна|ична)[ \t]+[А-ЯЁ][а-яё]{2,30}(?![\p{L}])/gu,
  ]) {
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
    /(?:компании|организации|company|organization|société|empresa|Firma)[ \t]+([\p{Lu}][\p{L}\p{M}&']{0,80}(?:-[\p{L}\p{M}\p{N}&']{1,40}){0,4})/gu,
    emit,
    details('ORGANIZATION', 'organization-context', 0.7),
    1,
    (value) => value.length >= 2
  );
  collectMatches(
    text,
    /(?<![\d(])(?:[78][ -]?)?\(\d{3}\)[ -]?\d{3}[ -]\d{2}[ -]?\d{2}(?!\d)|(?<![\d-])(?:(?<![\p{L}_.])1[.-])?(?:\d{3}[.-]){2}\d{4}(?!\d|-[\p{L}\p{N}])/gu,
    emit,
    details('PHONE', 'national-phone')
  );
  collectMatches(
    text,
    flatRegExp(
      /(?<![\p{L}\p{N}])\d{1,6}[A-Za-z]?[ \t]+(?:[\p{Lu}][\p{L}.'-]*[ \t]+){1,5}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd|Way|Terrace|Court|Ct|Place|Pl|Parkway|Pkwy|Circle|Highway|Hwy|Square|Crescent|Close|Straße|Strasse|Rue|Calle|Rua)\b(?:,?[ \t]+(?:Apt|Apartment|Suite|Ste|Unit|Floor|Fl|Room|Rm)\.?[ \t]*#?[A-Za-z0-9-]{1,6}\b|[ \t]+#[A-Za-z0-9-]{1,6}\b)?(?:,[ \t]+(?:(?:[^ \t\r\n<>][^\r\n<>]{0,79}?[ \t]+)?(?:[A-Z]{1,2}\d[A-Z\d]?[ \t]+\d[A-Z]{2}|\d{5}(?:-\d{4})?)\b|(?:[\p{Lu}][\p{Ll}.'-]+[ \t]*){1,4}))?/gu
    ),
    emit,
    details('ADDRESS', 'postal-address')
  );
  // "Mr. O'Brien", "Dr Jane Smith": a courtesy title is name evidence;
  // after a number, "30 Ms Retry" is a millisecond unit.
  collectMatches(
    text,
    /(?<![\p{L}\p{N}_])(?:Mr|Mrs|Ms|Mx|Miss|Dr|Prof)(?<!\p{N}[ \t]*\p{L}+)\.?[ \t]+(\p{Lu}(?:['’]\p{Lu})?[\p{Ll}\p{M}]+(?:-\p{Lu}[\p{Ll}\p{M}]+)?(?:[ \t]+\p{Lu}(?:['’]\p{Lu})?[\p{Ll}\p{M}]+(?:-\p{Lu}[\p{Ll}\p{M}]+)?)?)(?![\p{L}\p{M}])/gu,
    emit,
    details('PERSON', 'honorific-name'),
    1,
    (value) => !placeWord.test(value.split(/[ \t]+/).at(-1))
  );
  collectMatches(
    text,
    // Colon, dash or Cisco dotted notation with one separator; the broadcast
    // and all-zero addresses identify no device.
    /(?<![\da-fA-F:.-])(?:[\da-fA-F]{2}([:-])(?:[\da-fA-F]{2}\1){4}[\da-fA-F]{2}|[\da-fA-F]{4}\.[\da-fA-F]{4}\.[\da-fA-F]{4})(?![\da-fA-F:-]|\.[\da-fA-F])/g,
    emit,
    details('MAC_ADDRESS', 'mac'),
    0,
    (value) => !/^(?:[fF]{2}[:.-]?|0{2}[:.-]?)+$/.test(value.replace(/\./g, ''))
  );
  collectMatches(
    text,
    /(?<![\p{L}\p{N}_.\]])@[\p{L}\p{N}_]{2,32}(?![\p{L}\p{N}_.])/gu,
    emit,
    details('USERNAME', 'messenger-handle', 0.65),
    0,
    (_value, match) => {
      const rest = text.slice(match.index + match[0].length);
      return (
        !/^\/[a-z0-9][a-z0-9_.-]*/i.test(rest) || mentionedEmail.test(rest)
      );
    }
  );
  collectMatches(
    text,
    /(?:\/Users\/|\/home\/|[A-Za-z]:\\(?:Users|Documents and Settings|(?:Windows|WINNT)\\Profiles)\\)([^/\\\s"'<>[\]]+)/g,
    emit,
    details('USERNAME', 'home-path', 0.95),
    1,
    (value) => !serviceAccounts.has(value.toLowerCase())
  );
  detectIban(text, emit);
}
