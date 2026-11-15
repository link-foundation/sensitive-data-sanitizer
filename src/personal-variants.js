import { eachMatch, escapePattern, failure } from './detection.js';
import { russianNameRoles } from './russian-names.js';
import { knownMatcher } from './compiled-known.js';
import { flatRegExp } from './unicode-runs.js';

const boundary = '[\\p{L}\\p{M}\\p{N}_]';
export function organizationCore(value) {
  return value
    .replace(/^(?:ООО|АО|ПАО|ИП|ЗАО)[ \t]+/u, '')
    .replace(/^[«“"]|[»”"]$/gu, '')
    .trim();
}
// `Вектор-1` also identifies its base name and numbered siblings like `Вектор-2`.
export function organizationFamily(core) {
  const base = /^(.{3,})-\d{1,9}$/u.exec(core)?.[1];
  return base
    ? {
        base,
        pattern: new RegExp(
          `(?<!${boundary})${escapePattern(base)}(?:-\\d{1,9})?(?!${boundary}|-\\d)`,
          'giu'
        ),
      }
    : undefined;
}
// ё and е are one letter in ordinary Russian writing; the i flag covers Ё and Е.
const foldYo = (pattern) => pattern.replace(/[еёЕЁ]/gu, '[её]');
const fleeting = { павел: 'Павл', лев: 'Льв' };
const hardCases = '(?:а|у|ом|е)';
// Only caller-confirmed Russian words receive finite case alternatives. A
// minimum three-letter stem avoids turning short names into broad matches.
// A family is named by the plural of a possessive or -ский surname:
// `Пряжкины`, `у Пряжкиных`, `с Ольховецкими`. Either gender of the
// surname names the family.
const possessivePlural = '|ы|ых|ым|ыми';
const adjectivePlural = '|ие|их|им|ими';
function cyrillicPattern(word, type) {
  const endings = [
    [/(?:ова|ева|ёва|ина|ына)$/u, 1, `(?:а|ой|ою|у|е|ы${possessivePlural})`],
    [/(?:ск|цк)ая$/u, 2, `(?:ая|ой|ою|ую${adjectivePlural})`],
    [/(?:ая)$/u, 2, '(?:ая|ой|ою|ую)'],
    [
      /(?:ск|цк)ий$/u,
      2,
      `(?:ий|ый|ой|ого|его|ому|ему|ым|ом|ем|ия|ию|ием|ии${adjectivePlural})`,
    ],
    [
      /(?:ий|ый|ой)$/u,
      2,
      '(?:ий|ый|ой|ого|его|ому|ему|им|ым|ом|ем|ия|ию|ием|ии)',
    ],
    [/[аеуюя]й$/u, 1, '(?:й|я|ю|ем|е)'],
    [/(?:ов|ев|ёв|ин|ын)$/u, 0, `(?:а|у|ом|е|ой${possessivePlural})?`],
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
const cyrillicWord = /^[а-яё]+$/iu;
const anyOf = (options) =>
  options.length === 1
    ? escapePattern(options[0])
    : `(?:${options.map(escapePattern).join('|')})`;
// Common romanizations of a Cyrillic word: ICAO 9303 and the
// MVD 2013 passport table, BGN/PCGN, GOST 7.79-B, the j-based GOST 16876
// style, ISO 9 letters and the popular -iy/-y endings. Each letter accepts the
// spelling of every system, so Tyutyunnik, Tiutiunnik and Tjutjunnik, or
// Evsey, Evsei and Yevsey, are all one pattern.
const latinLetters = {
  а: ['a'],
  б: ['b'],
  в: ['v'],
  г: ['g'],
  д: ['d'],
  е: ['e'],
  ё: ['e', 'yo', 'jo', 'io', 'ë'],
  ж: ['zh', 'ž'],
  з: ['z'],
  и: ['i'],
  й: ['y', 'i', 'j'],
  к: ['k'],
  л: ['l'],
  м: ['m'],
  н: ['n'],
  о: ['o'],
  п: ['p'],
  р: ['r'],
  с: ['s'],
  т: ['t'],
  у: ['u'],
  ф: ['f'],
  х: ['kh', 'h', 'x'],
  ц: ['ts', 'tz', 'cz', 'c'],
  ч: ['ch', 'č'],
  ш: ['sh', 'š'],
  щ: ['shch', 'sch', 'shh', 'ŝ'],
  ъ: ['', 'ie', "'", '"', 'ʺ'],
  ы: ['y'],
  ь: ['', 'y', "'", 'ʹ', '’'],
  э: ['e', 'eh', 'è'],
  ю: ['yu', 'iu', 'ju', 'û'],
  я: ['ya', 'ia', 'ja', 'â'],
};
// BGN/PCGN and popular spelling write a word-initial or post-vowel е as ye.
const iotating = /[аеёиоуыэюяъьй]/u;
const latinEndings = [
  [/ий$/u, ['iy', 'ii', 'ij', 'y', 'i']],
  [/ый$/u, ['yy', 'yi', 'yj', 'y', 'iy', 'ij']],
  [/ия$/u, ['iya', 'ia', 'iia', 'ija']],
];
function latinChunks(word) {
  const lower = word.toLowerCase();
  const ending =
    lower.length > 2
      ? latinEndings.find(([pattern]) => pattern.test(lower))
      : undefined;
  const body = ending ? lower.slice(0, -2) : lower;
  const chunks = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] === 'к' && body[i + 1] === 'с') {
      chunks.push(['ks', 'x']);
      i++;
    } else if (body[i] === 'е' && (i === 0 || iotating.test(body[i - 1]))) {
      chunks.push(['e', 'ye', 'je']);
    } else {
      chunks.push(latinLetters[body[i]]);
    }
  }
  return ending ? [...chunks, ending[1]] : chunks;
}
const latinPattern = (word) => latinChunks(word).map(anyOf).join('');
// Optional entry flags: `transliterate` adds the Latin spellings of Cyrillic
// words. Callers without flags keep the exact Cyrillic grammar.
export function wordPattern(word, type, flags) {
  const parts = word.split('-');
  const native = foldYo(
    parts
      .map((part) =>
        cyrillicWord.test(part)
          ? cyrillicPattern(part, type)
          : escapePattern(part)
      )
      .join('-')
  );
  if (!flags?.transliterate || !parts.some((part) => cyrillicWord.test(part))) {
    return native;
  }
  const latin = parts
    .map((part) =>
      cyrillicWord.test(part) ? latinPattern(part) : escapePattern(part)
    )
    .join('-');
  return `(?:${native}|${latin})`;
}
// The line break that may split a listed value, optionally followed by the
// comment or quote prefix that continues the line.
const lineBreak =
  '[ \\t\\u00a0]*(?:\\r\\n?|\\n)[ \\t\\u00a0]*(?:(?:\\/\\/+|#+|--|\\*+|(?:>[ \\t]?)+|;+)[ \\t\\u00a0]*)?';
// In text the parts of a name are split by spaces and by the punctuation of
// tables, lists, quotes and Markdown: `Пряжкина, Велимира`,
// `| Пряжкина | Велимира |`, `"Пряжкина", "Велимира"`, `**Пряжкина** Велимира`,
// `Пряжкина (Велимира)`, `Пряжкина — Велимира`. One line break may follow,
// with the comment or quote prefix (`//`, `#`, `--`, `*`, `>`, `;`) that
// continues the line; a blank line still separates. Only `'`, `-` or `_`
// between two letters keeps the letters one word, as in `O'Neil`,
// `Римский-Корсаков` or `snake_case`. The marks before and after the line break are two
// quantifiers that the line break divides, so a long run of marks cannot
// backtrack quadratically.
const marks = ' \\t\\u00a0,;|/\\\\()\\[\\]{}"«»“”„‘’\'*_`—–‒―\\-';
const gapMarks = `[${marks}]`;
const nextLineMarks = `[${marks}#>]`;
const textGap = `(?![_'’\\-]+\\p{L})(?=[${marks}\\r\\n])${gapMarks}*(?:(?:\\r\\n?|\\n)${nextLineMarks}*)?`;
// In identifiers the words of a value are also joined by `_`, `-`, `.` or a
// case change: `evsey_tyutyunnik`, `EvseyTyutyunnik`.
const identifierGap = `(?:${textGap}|[_.-]|(?<=\\p{Ll})(?=\\p{Lu}))`;
const gapFor = (flags) => (flags?.identifiers ? identifierGap : textGap);
// Initials may touch each other and the surname: `Е.О.Тютюнник`.
const initialGap = `(?:${textGap})?`;
const separator = new RegExp(`([ \\t]+|${lineBreak})`, 'u');
// An initial is an upper-case letter: a lone lower-case letter is a
// preposition, conjunction or particle (`в`, `с`, `и`, `ж`), so
// `Он же в офисе.` is no `Же В.`. Person expressions run without the `i`
// flag (see `personalSource`), and the letter is a code point escape, which
// `caseless` keeps in its one case.
const upperEscape = (text) =>
  [...text.toUpperCase()]
    .map((char) => `\\u{${char.codePointAt(0).toString(16)}}`)
    .join('');
function initialLetter(word, flags) {
  const first = [...word][0];
  const native = [
    ...new Set([first, ...(/[её]/iu.test(first) ? ['е', 'ё'] : [])]),
  ];
  const latin =
    flags?.transliterate && cyrillicWord.test(first)
      ? latinChunks(first)[0].filter(Boolean)
      : [];
  const options = [
    ...new Set(native.map(upperEscape)),
    ...latin.map(
      (chunk) => upperEscape([...chunk][0]) + escapePattern(chunk.slice(1))
    ),
  ];
  return options.length === 1 ? options[0] : `(?:${options.join('|')})`;
}
const initialPattern = (word, flags) => `${initialLetter(word, flags)}\\.`;
// The initial of a patronymic that is not listed: `Тютюнник Е.О.` for the
// listed `Тютюнник Евсей`.
const anyInitial = '\\p{Lu}\\.';
const withSecond = (initial) => `${initial}(?:${initialGap}${anyInitial})?`;
// A given name with the initial of the surname, as in `Велимира П.` or
// `Velimira P.`, is the everyday short form in chats and notes.
const givenAndInitial = (given, surname, type, flags) =>
  `${wordPattern(given, type, flags)}${textGap}${initialLetter(surname, flags)}\\.?`;
// A surname with the initial of the given name after or before it, whatever
// the surname's ending: `Тютюнник Е.`, `Е. Тютюнник`, `Е.Тютюнник`. When no
// patronymic is listed, any second initial stands for it: `Тютюнник Е.О.`,
// `Е. О. Тютюнник`.
const initialForms = (last, initial, gap) => [
  `${last}${gap}${withSecond(initial)}`,
  `${withSecond(initial)}${initialGap}${last}`,
];
// Everyday orders, partial forms and initials of a Russian full name, longest
// first so that alternation prefers the complete form at each position. A
// given name with its patronymic names the person least: the text matches it
// only when it is listed itself, while `related` still links it to the full
// name when deciding which listed person a found value is.
function russianForms(words, roles, type, flags, related) {
  const name = Object.fromEntries(
    Object.entries(roles).map(([role, i]) => [role, words[i]])
  );
  const gap = gapFor(flags);
  const full = (...parts) =>
    parts.map((part) => wordPattern(part, type, flags)).join(gap);
  if (name.surname === undefined) {
    return [];
  }
  const initial = initialPattern(name.given, flags);
  const last = wordPattern(name.surname, type, flags);
  const short = [
    full(name.surname, name.given),
    full(name.given, name.surname),
    ...initialForms(last, initial, gap),
    givenAndInitial(name.given, name.surname, type, flags),
  ];
  if (name.patronymic === undefined) {
    return short;
  }
  const initials = `${initial}${initialGap}${initialPattern(name.patronymic, flags)}`;
  return [
    full(name.surname, name.given, name.patronymic),
    full(name.given, name.patronymic, name.surname),
    `${last}${textGap}${initials}`,
    `${initials}${initialGap}${last}`,
    ...short,
    ...(related ? [full(name.given, name.patronymic)] : []),
  ];
}
// Two words whose roles are unknown, such as `Тютюнник Евсей` or `John Smith`,
// match in either order and with the other word reduced to its initial,
// written after the word or, with a period, before it.
function pairForms(words, type, flags) {
  const [first, second] = words.map((word) => wordPattern(word, type, flags));
  const withInitial = (name, word) =>
    `${name}${textGap}${initialLetter(word, flags)}(?:\\.(?:${initialGap}${anyInitial})?)?`;
  return [
    `${second}${gapFor(flags)}${first}`,
    withInitial(first, words[1]),
    withInitial(second, words[0]),
    `${withSecond(initialPattern(words[0], flags))}${initialGap}${second}`,
    `${withSecond(initialPattern(words[1], flags))}${initialGap}${first}`,
  ];
}
export function personalPatterns(value, type, flags, related = false) {
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
    const parts = surface.split(separator);
    patterns.add(
      parts
        .map((part, i) =>
          i % 2 ? gapFor(flags) : wordPattern(part, type, flags)
        )
        .join('')
    );
    if (type !== 'PERSON') {
      continue;
    }
    const words = parts.filter((_part, i) => i % 2 === 0);
    const roles = russianNameRoles(words);
    const forms = roles ? russianForms(words, roles, type, flags, related) : [];
    if (words.length === 2) {
      forms.push(
        ...(roles
          ? [pairForms(words, type, flags)[0]]
          : pairForms(words, type, flags))
      );
    }
    for (const form of forms) {
      patterns.add(form);
    }
  }
  return [...patterns];
}
// With `identifiers` a value is also a segment of a code
// identifier: `_`, digits and a lower-to-upper case change end it, as in
// `tyutyunnik_marketing`, `tyutyunnikCase` and `TYUTYUNNIK_CALLS`. A case
// change cannot be tested under the `i` flag, which folds `\p{Lu}` and
// `\p{Ll}` together, so such patterns spell out both cases of each letter.
const caseEdge = '(?<=\\p{Ll})(?=\\p{Lu})|(?<=\\p{Lu})(?=\\p{Lu}\\p{Ll})';
const segmentStart = `(?:(?<![\\p{L}\\p{M}])|${caseEdge})`;
const segmentEnd = `(?:(?![\\p{L}\\p{M}])|${caseEdge})`;
const escapeToken = /\\(?:u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|[pP]\{[^}]*\}|.)/su;
const bothCases = (letter) =>
  [...new Set([letter, letter.toLowerCase(), letter.toUpperCase()])]
    .filter((variant) => [...variant].length === 1)
    .join('');
function caseless(pattern) {
  const token = new RegExp(
    `${escapeToken.source}|\\[(?:\\\\.|[^\\]\\\\])*\\]|\\p{L}`,
    'gsu'
  );
  const inClass = new RegExp(`${escapeToken.source}|\\p{L}`, 'gsu');
  return pattern.replace(token, (part) => {
    if (part.startsWith('\\')) {
      return part;
    }
    if (part.startsWith('[')) {
      return part.replace(inClass, (atom) =>
        atom.startsWith('\\') ? atom : bothCases(atom)
      );
    }
    const variants = bothCases(part);
    return [...variants].length > 1 ? `[${variants}]` : part;
  });
}
// A `_` joins a value of several words to a word only between letters or
// digits (`tyutyunnik evsey_cv`); at a word edge it is Markdown emphasis
// (`_Тютюнник Евсей_`, `__Тютюнник__ Евсей`). A one-word value keeps `_` as
// part of a word, since `_Lee` and `Lee_` may be identifier fragments.
const wordChar = '[\\p{L}\\p{M}\\p{N}]';
const textStart = `(?<!${wordChar}|${wordChar}_+)`;
const textEnd = `(?!${wordChar}|_+${wordChar})`;
// Person expressions spell out both cases of each letter and run without the
// `i` flag, so an initial can require an upper-case letter.
export function personalSource(value, type, flags) {
  if (type === 'URL') {
    let core = value.replace(/^https?:\/\//iu, '');
    const suffix = core.search(/[?#]/u);
    if (suffix >= 0) {
      core = core.slice(0, suffix);
    }
    let end = core.length;
    while (end > 0 && core[end - 1] === '/') {
      end--;
    }
    core = core.slice(0, end);
    return `(?<![\\p{L}\\p{N}_./-])(?:https?:\\/\\/)?${escapePattern(core)}(?:\\/)?(?:[?#][^\\s"<>\\\\]*)?(?![\\p{L}\\p{N}_-])`;
  }
  const alternatives = personalPatterns(value, type, flags).join('|');
  if (flags?.identifiers) {
    return `${segmentStart}(?:${caseless(alternatives)})${segmentEnd}`;
  }
  const body = type === 'PERSON' ? caseless(alternatives) : alternatives;
  return /\s/u.test(value.trim())
    ? `${textStart}(?:${body})${textEnd}`
    : `(?<!${boundary})(?:${body})(?!${boundary})`;
}
// `sticky` expressions match only at their lastIndex; the known matcher sets
// it to each position where an anchor of the entry occurs.
export function sourceRegex(source, type, flags, sticky = false) {
  const mode = sticky ? 'y' : 'g';
  if (type === 'URL') {
    return flatRegExp(new RegExp(source, `${mode}iu`));
  }
  const caseFlag = flags?.identifiers || type === 'PERSON' ? '' : 'i';
  return new RegExp(source, `${mode}${caseFlag}u`);
}
export const personalRegex = (value, type, flags) =>
  sourceRegex(personalSource(value, type, flags), type, flags);
// `flags` are the entry's own options, so a transliterated surface is the
// same listed person as its Cyrillic value.
export function samePersonal(value, original, type, flags) {
  return personalPatterns(original, type, flags, true).some((pattern) =>
    new RegExp(`^(?:${pattern})$`, 'iu').test(value)
  );
}
function familyPatterns(entries, rule, options) {
  return rule === 'confirmed-personal' &&
    options.documentEntities &&
    !options.knownOnly
    ? entries.map((entry) =>
        entry.type === 'ORGANIZATION'
          ? organizationFamily(organizationCore(entry.value))?.pattern
          : undefined
      )
    : [];
}
// An entry's expression runs only when the text holds one of its literal
// anchors, so a call costs in proportion to the text, not to the list.
export function detectKnownPersonal(text, entries, rule, emit, options) {
  if (!entries?.length) {
    return;
  }
  const families = familyPatterns(entries, rule, options);
  let count = 0;
  const visit = (entry, match) => {
    // A stored capitalized word in lower case is ordinary text: `Мороз`, `мороз`.
    if (entry.properCase && /^\p{Ll}/u.test(match[0])) {
      return;
    }
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
  };
  knownMatcher(entries).each(text, (index, match) =>
    visit(entries[index], match)
  );
  for (const [index, family] of families.entries()) {
    if (family) {
      eachMatch(text, family, (match) => visit(entries[index], match));
    }
  }
}
