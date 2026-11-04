import { escapePattern, failure } from './detection.js';
import { russianNameRoles } from './russian-names.js';

const boundary = '[\\p{L}\\p{M}\\p{N}_]';
export function organizationCore(value) {
  return value
    .replace(/^(?:ООО|АО|ПАО|ИП|ЗАО)[ \t]+/u, '')
    .replace(/^[«“"]|[»”"]$/gu, '')
    .trim();
}
// ё and е are one letter in ordinary Russian writing; the i flag covers Ё and Е.
const foldYo = (pattern) => pattern.replace(/[еёЕЁ]/gu, '[её]');
const fleeting = { павел: 'Павл', лев: 'Льв' };
const hardCases = '(?:а|у|ом|е)';
// Only caller-confirmed Russian words receive finite case alternatives. A
// minimum three-letter stem avoids turning short names into broad matches.
function cyrillicPattern(word, type) {
  const endings = [
    [/(?:ова|ева|ина)$/u, 1, '(?:а|ой|ою|у|е|ы)'],
    [/(?:ая)$/u, 2, '(?:ая|ой|ою|ую)'],
    [
      /(?:ий|ый|ой)$/u,
      2,
      '(?:ий|ый|ой|ого|его|ому|ему|им|ым|ом|ем|ия|ию|ием|ии)',
    ],
    [/[аеуюя]й$/u, 1, '(?:й|я|ю|ем|е)'],
    [/(?:ов|ев|ин)$/u, 0, '(?:а|у|ым|ом|е|ой)?'],
    [/[жчшщц]$/u, 0, '(?:а|у|ем|ом|е)?'],
    [/[жчшщц]а$/u, 1, '(?:а|и|е|у|ей|ею|ой|ою)'],
    [/а$/u, 1, '(?:а|ы|и|е|у|ой|ою)'],
    [/я$/u, 1, '(?:я|и|е|ю|ей|ею)'],
    [/ь$/u, 1, '(?:ь|я|ю|ем|е|и|ью)'],
  ];
  const lower = word.toLowerCase();
  if (fleeting[lower]) {
    return `(?:${word}|${fleeting[lower]}${hardCases})`;
  }
  for (const [ending, remove, suffix] of endings) {
    if (ending.test(lower) && word.length - remove >= 3) {
      return escapePattern(remove ? word.slice(0, -remove) : word) + suffix;
    }
  }
  if (/^[а-яё]{3,}[бвгджзклмнпрстфхцчшщ]$/u.test(lower)) {
    // Plural forms would turn a given name into a surname: Петр and Петров.
    return `${escapePattern(word)}${type === 'PERSON' ? `${hardCases}?` : '(?:а|у|ом|е|ы|ов|ам|ами|ах)?'}`;
  }
  return escapePattern(word);
}
function wordPattern(word, type) {
  return foldYo(
    word
      .split('-')
      .map((part) =>
        /^[а-яё]+$/iu.test(part)
          ? cyrillicPattern(part, type)
          : escapePattern(part)
      )
      .join('-')
  );
}
const initialGap = '[ \\t\\u00a0]*';
const initialPattern = (word) => `${foldYo(escapePattern(word[0]))}\\.`;
// Everyday orders, partial forms and initials of a Russian full name, longest
// first so that alternation prefers the complete form at each position.
function russianForms(words, roles, type) {
  const name = Object.fromEntries(
    Object.entries(roles).map(([role, i]) => [role, words[i]])
  );
  const gap = '[ \\t]+';
  const full = (...parts) =>
    parts.map((part) => wordPattern(part, type)).join(gap);
  if (name.surname === undefined) {
    return [];
  }
  const initial = initialPattern(name.given);
  const last = wordPattern(name.surname, type);
  const short = [
    full(name.surname, name.given),
    full(name.given, name.surname),
    `${last}${gap}${initial}`,
    `${initial}[ \\t\\u00a0]+${last}`,
  ];
  if (name.patronymic === undefined) {
    return short;
  }
  const initials = `${initial}${initialGap}${initialPattern(name.patronymic)}`;
  return [
    full(name.surname, name.given, name.patronymic),
    full(name.given, name.patronymic, name.surname),
    `${last}[ \\t\\u00a0]+${initials}`,
    `${initials}[ \\t\\u00a0]+${last}`,
    ...short,
    full(name.given, name.patronymic),
  ];
}
export function personalPatterns(value, type) {
  if (value.length > 256) {
    // Large explicit values still support literal matching without expansion.
    return [escapePattern(value)];
  }
  const values = new Set([value]);
  if (type === 'ORGANIZATION') {
    const core = organizationCore(value);
    if (core.length >= 3) {
      values.add(core);
    }
  }
  const patterns = new Set();
  for (const surface of values) {
    const parts = surface.split(/([ \t]+)/u);
    const pattern = parts
      .map((part, i) => (i % 2 ? '[ \\t]+' : wordPattern(part, type)))
      .join('');
    patterns.add(pattern);
    if (type === 'PERSON') {
      const words = parts.filter((_part, i) => i % 2 === 0);
      const roles = russianNameRoles(words);
      for (const form of roles ? russianForms(words, roles, type) : []) {
        patterns.add(form);
      }
      if (words.length === 2) {
        patterns.add(
          [wordPattern(words[1], type), wordPattern(words[0], type)].join(
            '[ \\t]+'
          )
        );
      }
    }
  }
  return [...patterns];
}
export function personalRegex(value, type) {
  return new RegExp(
    `(?<!${boundary})(?:${personalPatterns(value, type).join('|')})(?!${boundary})`,
    'giu'
  );
}
export function samePersonal(value, original, type) {
  return personalPatterns(original, type).some((pattern) =>
    new RegExp(`^(?:${pattern})$`, 'iu').test(value)
  );
}
export function detectKnownPersonal(text, entries, rule, emit, options) {
  let count = 0;
  for (const entry of entries ?? []) {
    for (const match of text.matchAll(personalRegex(entry.value, entry.type))) {
      if (++count > (options.maxFindings ?? 100000)) {
        throw failure('ERR_LIMIT');
      }
      emit({
        start: match.index,
        end: match.index + match[0].length,
        type: entry.type,
        category: 'personal',
        rule,
        confidence: rule === 'known-personal' ? 0.85 : 0.9,
      });
    }
  }
}
