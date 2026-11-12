import { collectMatches } from './detection.js';
import { isDocumentTechnology } from './document-experience.js';
import { flatRegExp } from './unicode-runs.js';
const letterRuns = flatRegExp(/[\p{L}]+/gu);

const b = '[\\p{L}\\p{N}_]';
const proper = '[\\p{Lu}][\\p{L}\\p{M}.-]{1,47}';
const rules = [
  [
    'PHONE',
    'document-local-phone',
    /(?<![\p{L}\p{N}_])(?:тел\.?|телефон|phone)[ \t]*:?[ \t]*(\d{7})(?!\d)/giu,
    1,
  ],
  [
    'PHONE',
    'document-spaced-mobile',
    /(?<![\p{L}\p{N}_])8[ \t]+9(?:[ \t]+\d){9}(?!\d)/gu,
    0,
  ],
  [
    'EMAIL',
    'document-email-obfuscation',
    /(?<![\p{L}\p{N}_])[\p{L}\p{N}_.+-]{1,64}\(собака\)[\p{L}\p{N}-]{1,63}(?:\(точка\)[\p{L}\p{N}-]{1,63}){1,6}(?![\p{L}\p{N}_])/giu,
    0,
  ],
  [
    'EMAIL',
    'document-email-spaces',
    /(?<![\p{L}\p{N}_])(?:[a-z][ \t]+){1,63}[a-z][ \t]*@[ \t]*[a-z\d-]{1,63}[ \t]*\.[ \t]*[a-z]{2,20}(?![\p{L}\p{N}_])/giu,
    0,
  ],
  [
    'USERNAME',
    'document-messenger',
    /(?<![\p{L}\p{N}_])(?:discord|max)[ \t]*:[ \t]*([a-z][a-z\d_.-]{1,63}(?:#\d{4})?)(?![\p{L}\p{N}_])/giu,
    1,
  ],
  [
    'URL',
    'document-social-link',
    flatRegExp(
      /(?<![\p{L}\p{N}_./-])(?:https?:\/\/)?(?:www\.)?(?:ok\.ru\/profile|gitlab\.com|habr\.com\/ru\/users|facebook\.com)\/[\p{L}\p{N}_.-]{2,100}(?:\/)?(?:[?#][^\s"<>\\]*)?/giu
    ),
    0,
  ],
  [
    'URL',
    'document-resume-link',
    flatRegExp(
      /https?:\/\/[^\s/"<>\\]+\/(?:cv\.pdf(?:[?#][^\s"<>\\]*)?|cv(?:\/[^\s"<>\\]*)?|~[\p{L}\p{N}_.-]{1,100}\/?)/giu
    ),
    0,
  ],
  [
    'DATE_OF_BIRTH',
    'document-birthday',
    /(?<![\p{L}\p{N}_])(?:д\.р\.|день рождения)[ \t]*:?[ \t]*(\d{1,2}(?:[/.]\d{1,2}[/.]\d{2,4}|[ \t]+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:[ \t]+\d{4})?))(?!\d)/giu,
    1,
  ],
  [
    'AGE',
    'document-age-unit',
    /(?<![\p{L}\p{N}_])\d{1,3}[ \t]*(?:y\.o\.|лет[ \t]+от[ \t]+роду)(?![\p{L}\p{N}_])/giu,
    0,
  ],
  [
    'ID',
    'document-military-id',
    /(?<![\p{L}\p{N}_])военный билет[ \t]+([А-ЯЁ]{2}[ \t]+\d{7})(?!\d)/giu,
    1,
  ],
  [
    'VIN',
    'document-vin',
    /(?<![\p{L}\p{N}_])VIN[ \t]*:?[ \t]*([A-HJ-NPR-Z\d]{17})(?![\p{L}\p{N}_])/giu,
    1,
  ],
  [
    'ORGANIZATION',
    'document-legal-lowercase',
    /(?<![\p{L}\p{N}_])(?:ооо|зао|пао|ао)[ \t]+[а-яё][а-яё-]{1,47}(?![\p{L}\p{N}_])/gu,
    0,
  ],
  [
    'ORGANIZATION',
    'document-employer-dash',
    new RegExp(
      `(?<!${b})(?:Компания|Место работы)[ \\t]+[-–—][ \\t]+(${proper})(?!${b})`,
      'gu'
    ),
    1,
  ],
  [
    'ORGANIZATION',
    'document-employer-prefix',
    new RegExp(`(?<!${b})(?:Группа|стартап)[ \\t]+(${proper})(?!${b})`, 'gu'),
    1,
  ],
  [
    'ORGANIZATION',
    'document-bank-suffix',
    new RegExp(`(?<!${b})${proper}[ \\t]+Банк(?!${b})`, 'gu'),
    0,
  ],
  [
    'ORGANIZATION',
    'document-industry',
    new RegExp(
      `(?<!${b})(${proper})(?=[ \\t]*\\((?:ритейл|retail|финансы|finance|IT)\\))`,
      'gu'
    ),
    1,
  ],
  [
    'ORGANIZATION',
    'document-reversed-role',
    new RegExp(
      `(?<!${b})(${proper})[ \\t]*(?:,|[-–—])[ \\t]*(?:менеджер|manager|директор|developer|инженер)(?!${b})`,
      'gu'
    ),
    1,
  ],
  [
    'ORGANIZATION',
    'document-role-employer',
    new RegExp(
      `(?<!${b})(?:менеджер|директор|инженер)[ \\t]+(?:в[ \\t]+)?(${proper})(?!${b})`,
      'gu'
    ),
    1,
  ],
  [
    'ORGANIZATION',
    'document-at-employer',
    /(?<![\p{L}\p{N}_])at[ \t]+([A-Z][a-z][\p{L}.-]{0,45})(?![\p{L}\p{N}_])/gu,
    1,
  ],
  [
    'EDUCATION',
    'document-school-context',
    /(?<![\p{L}\p{N}_])(?:graduated from|бакалавр,?|диплом|колледж|[Кк]урсы|курс на)[ \t]+([\p{Lu}][\p{L}.-]{1,47})(?![\p{L}\p{N}_])/gu,
    1,
  ],
  [
    'EDUCATION',
    'document-school-year',
    /(?<![\p{L}\p{N}_])[А-ЯЁA-Z]{2,12}(?=,[ \t]*(?:19|20)\d{2}(?!\d))/gu,
    0,
  ],
  [
    'EDUCATION',
    'document-msu',
    /(?<![\p{L}\p{N}_])МГУ(?:[ \t]+им\.[ \t]+[А-ЯЁ][а-яё-]{1,40})?(?![\p{L}\p{N}_])/gu,
    0,
  ],
  [
    'PERSON',
    'document-patronymic',
    /(?<![\p{L}\p{N}_])[А-ЯЁ][а-яё]{2,32}(?:овна|евна|ична|ович|евич)(?![\p{L}\p{N}_])/gu,
    0,
  ],
  [
    'PERSON',
    'document-uppercase-initials',
    /(?<![\p{L}\p{N}_])[А-ЯЁ]{2,40}[ \t]+(?:[А-ЯЁA-Z]\.[ \t]*){1,2}(?![\p{L}\p{N}_])/gu,
    0,
  ],
  [
    'PERSON',
    'document-unfamiliar-name',
    /(?<![\p{L}\p{N}_])(?:[А-ЯЁ][а-яё]{1,30}[ \t]+(?:Ким|[А-ЯЁ][а-яё]{1,25}(?:чук|енко|швили|дзе))|Ли[ \t]+[А-ЯЁ][а-яё]{1,20})(?![\p{L}\p{N}_])/gu,
    0,
  ],
  [
    'ADDRESS',
    'document-street-complete',
    /(?<![\p{L}\p{N}_])(?:(?:ул\.?|улица|пр-т)[ \t]+[А-ЯЁ][а-яё-]{1,40},?[ \t]+(?:д\.[ \t]*)?\d{1,5}(?:-\d{1,5})?|[А-ЯЁ][а-яё-]{2,40}[ \t]+шоссе,[ \t]*\d{1,5})(?:,[ \t]*кв\.?[ \t]*\d{1,5})?(?!\d)/gu,
    0,
  ],
  [
    'LOCATION',
    'document-region',
    /(?<![\p{L}\p{N}_])[А-ЯЁ][а-яё-]{2,40}[ \t]+(?:область|район)(?![\p{L}\p{N}_])/gu,
    0,
  ],
  [
    'PERSONAL_ATTRIBUTE',
    'document-citizenship',
    /(?<![\p{L}\p{N}_])(?:гражданство|гражданин|гражданка)[ \t]+([А-ЯЁ][А-ЯЁа-яё-]{1,40})(?![\p{L}\p{N}_])/gu,
    1,
  ],
  [
    'LICENSE_PLATE',
    'document-vehicle-plate',
    /(?<![\p{L}\p{N}_])[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}[ \t]*\d{2,3}(?:[ \t]+RUS)?(?![\p{L}\p{N}_])/gu,
    0,
  ],
];

export function detectDocumentCatalog(text, emit) {
  for (const [type, rule, pattern, group] of rules) {
    collectMatches(
      text,
      pattern,
      emit,
      { type, rule, category: 'personal', confidence: 0.85 },
      group,
      (value) => type !== 'ORGANIZATION' || !isDocumentTechnology(value)
    );
  }
  // Lookalike substitution preserves UTF-16 offsets and is limited to words
  // containing Cyrillic plus Latin letters. Ordinary English is untouched.
  const lookalikes = {
    A: 'А',
    a: 'а',
    B: 'В',
    C: 'С',
    c: 'с',
    E: 'Е',
    e: 'е',
    H: 'Н',
    K: 'К',
    M: 'М',
    O: 'О',
    o: 'о',
    P: 'Р',
    p: 'р',
    T: 'Т',
    X: 'Х',
    x: 'х',
    y: 'у',
  };
  const folded = text.replace(letterRuns, (word) =>
    /[А-Яа-яЁё]/u.test(word)
      ? word.replace(/[AaBCcEeHKMOoPpTXxy]/g, (c) => lookalikes[c])
      : word
  );
  if (folded !== text) {
    collectMatches(
      folded,
      /(?<![\p{L}\p{N}_])[А-ЯЁ][а-яё]{1,30}[ \t]+[А-ЯЁ][а-яё]{1,28}(?:ова|ева|ина|ов|ев|ин|ский|ская)(?![\p{L}\p{N}_])/gu,
      emit,
      {
        type: 'PERSON',
        rule: 'document-mixed-name',
        category: 'personal',
        confidence: 0.9,
      }
    );
  }
}
