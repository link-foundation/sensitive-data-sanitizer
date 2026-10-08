import { createHmac } from 'node:crypto';
import {
  Faker,
  en,
  es,
  fr,
  de,
  pt_BR,
  ru,
  ja,
  zh_CN,
  zh_TW,
  ko,
  ar,
  he,
  tr,
  id_ID,
  vi,
  th,
} from '@faker-js/faker';
import { firstNames } from './names.js';

const hi = {
  person: {
    first_name: {
      female: ['प्रिया', 'पूजा', 'नेहा', 'मीरा'],
      male: ['अर्जुन', 'अमित', 'विजय', 'राहुल'],
    },
    last_name: { generic: ['शर्मा', 'गुप्ता', 'वर्मा', 'सिंह'] },
  },
};
const locales = {
  en,
  es,
  fr,
  de,
  pt: pt_BR,
  ru,
  ruLatn: ru,
  ja,
  zh: zh_CN,
  'zh-Hant': zh_TW,
  ko,
  ar,
  he,
  hi,
  tr,
  id: id_ID,
  vi,
  th,
};
const transliteration = Object.fromEntries(
  Array.from('абвгдеёжзийклмнопрстуфхцчшщъыьэюя').map((letter, i) => [
    letter,
    [
      'a',
      'b',
      'v',
      'g',
      'd',
      'e',
      'e',
      'zh',
      'z',
      'i',
      'y',
      'k',
      'l',
      'm',
      'n',
      'o',
      'p',
      'r',
      's',
      't',
      'u',
      'f',
      'kh',
      'ts',
      'ch',
      'sh',
      'shch',
      '',
      'y',
      '',
      'e',
      'yu',
      'ya',
    ][i],
  ])
);
export function latinName(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[а-яё]/g, (c) => transliteration[c]);
}
const given = new Map();
for (const [locale, list] of Object.entries(firstNames)) {
  for (const name of list.split(' ')) {
    given.set(latinName(name), locale);
  }
}
const surnames = new Map(),
  female = new Set();
for (const [locale, data] of Object.entries(locales)) {
  for (const name of data.person?.first_name?.female ?? []) {
    female.add(latinName(name));
  }
  for (const names of Object.values(data.person?.last_name ?? {})) {
    for (const name of names) {
      if (!surnames.has(latinName(name))) {
        surnames.set(latinName(name), locale);
      }
    }
  }
}
const femaleNames =
  /^(?:marina|anna|mariya|maria|elena|olga|natalya|irina|svetlana|tatyana|ekaterina|anastasia|yulia|mary|jane|alice|emma|sarah|jessica|patricia|jennifer|linda|elizabeth|barbara|susan|olivia)$/;
function scriptLocale(value) {
  for (const [script, locale] of [
    ['Cyrillic', 'ru'],
    ['Arabic', 'ar'],
    ['Hebrew', 'he'],
    ['Devanagari', 'hi'],
    ['Thai', 'th'],
    ['Hangul', 'ko'],
    ['Hiragana', 'ja'],
    ['Katakana', 'ja'],
    ['Han', 'zh'],
  ]) {
    if (new RegExp(`\\p{Script=${script}}`, 'u').test(value)) {
      return locale;
    }
  }
  return undefined;
}
export function fakeName(value, key) {
  return value.replace(/[\p{L}\p{M}]+/gu, (word) => {
    for (const locale of ['ja', 'zh', 'ko']) {
      const family = firstNames[locale]
        .split(' ')
        .find((name) => word.startsWith(name) && word.length > name.length);
      if (family) {
        return (
          fakeWord(family, key, 'lastName', locale) +
          fakeWord(word.slice(family.length), key, 'firstName', locale)
        );
      }
    }
    return fakeWord(word, key);
  });
}
function wordProfile(word, forcedRole, forcedLocale) {
  const canonical = latinName(word);
  const patronymic = /(?:vich|vna|ichna|ogly|kyzy)$/.test(canonical);
  const slavic = /(?:ova|eva|ov|ev|in|ina|enko|sky|ski|skaya)$/.test(canonical);
  const locale =
    forcedLocale ??
    scriptLocale(word) ??
    given.get(canonical) ??
    (slavic || patronymic ? 'ru' : (surnames.get(canonical) ?? 'en'));
  const sex =
    femaleNames.test(canonical) ||
    female.has(canonical) ||
    /(?:ova|eva|ina|skaya|vna|ichna|kyzy)$/.test(canonical)
      ? 'female'
      : 'male';
  const role =
    forcedRole ??
    (patronymic
      ? 'middleName'
      : given.has(canonical) &&
          !['jaLatn', 'zhLatn', 'vi', 'ja', 'zh', 'ko'].includes(
            given.get(canonical)
          )
        ? 'firstName'
        : 'lastName');
  return { canonical, locale, sex, role };
}
function fakeWord(word, key, forcedRole, forcedLocale) {
  const { canonical, locale, sex, role } = wordProfile(
    word,
    forcedRole,
    forcedLocale
  );
  const faker = new Faker({ locale: [locales[locale] ?? en, en] });
  faker.seed(
    createHmac('sha256', key)
      .update(`name\0${canonical}\0${role}`)
      .digest()
      .readUInt32BE(0)
  );
  let replacement;
  for (let attempt = 0; attempt < 100; attempt++) {
    replacement = faker.person[role](sex).replace(/[ -].*$/, '');
    if (
      latinName(replacement) !== canonical &&
      (!/^\p{Script=Han}+$/u.test(word) ||
        /^\p{Script=Han}+$/u.test(replacement))
    ) {
      break;
    }
  }
  if (!scriptLocale(word) && /\p{Script=Cyrillic}/u.test(replacement)) {
    replacement = latinName(replacement);
  }
  if (latinName(replacement) === canonical) {
    replacement = faker.person[role](sex).replace(/[ -].*$/, '');
    if (!scriptLocale(word)) {
      replacement = latinName(replacement);
    }
  }
  if (word === word.toUpperCase()) {
    return replacement.toUpperCase();
  }
  if (word === word.toLowerCase()) {
    return replacement.toLowerCase();
  }
  return replacement[0].toUpperCase() + replacement.slice(1).toLowerCase();
}
