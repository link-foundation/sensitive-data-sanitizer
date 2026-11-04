import { escapePattern, failure } from './detection.js';

const boundary = '[\\p{L}\\p{M}\\p{N}_]';
export function organizationCore(value) {
  return value
    .replace(/^(?:ООО|АО|ПАО|ИП|ЗАО)[ \t]+/u, '')
    .replace(/^[«“"]|[»”"]$/gu, '')
    .trim();
}
// Only caller-confirmed Russian words receive finite case alternatives. A
// minimum three-letter stem avoids turning short names into broad matches.
function wordPattern(word) {
  const endings = [
    [/(?:ова|ева|ина)$/u, 1, '(?:а|ой|ою|у|е|ы)'],
    [/(?:ая)$/u, 2, '(?:ая|ой|ою|ую)'],
    [
      /(?:ий|ый|ой)$/u,
      2,
      '(?:ий|ый|ой|ого|его|ому|ему|им|ым|ом|ем|ия|ию|ием|ии)',
    ],
    [/(?:ов|ев|ин)$/u, 0, '(?:а|у|ым|ом|е|ой)?'],
    [/а$/u, 1, '(?:а|ы|и|е|у|ой|ою)'],
    [/я$/u, 1, '(?:я|и|е|ю|ей|ею)'],
    [/ь$/u, 1, '(?:ь|я|ю|ем|и)'],
  ];
  const lower = word.toLowerCase();
  if (/^[а-яё]+$/u.test(lower)) {
    for (const [ending, remove, suffix] of endings) {
      if (ending.test(lower) && word.length - remove >= 3) {
        return escapePattern(remove ? word.slice(0, -remove) : word) + suffix;
      }
    }
  }
  if (/^[а-яё]{4,}[бвгджзклмнпрстфхцчшщ]$/u.test(lower)) {
    return `${escapePattern(word)}(?:а|у|ом|е|ы|ов|ам|ами|ах)?`;
  }
  return escapePattern(word);
}
export function personalPatterns(value, type) {
  if (value.length > 256) {
    // Large explicit values still support literal matching without expansion.
    return [escapePattern(value)];
  }
  const values = new Set([value]);
  if (type === 'ORGANIZATION') {
    values.add(organizationCore(value));
  }
  const patterns = new Set();
  for (const surface of values) {
    const parts = surface.split(/([ \t]+)/u);
    const pattern = parts
      .map((part, i) => (i % 2 ? '[ \\t]+' : wordPattern(part)))
      .join('');
    patterns.add(pattern);
    if (type === 'PERSON' && parts.length === 3) {
      patterns.add(
        [wordPattern(parts[2]), wordPattern(parts[0])].join('[ \\t]+')
      );
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
