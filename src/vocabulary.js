import { failure, collectMatches, escapePattern } from './detection.js';
import { wordPattern } from './personal-variants.js';
import { fieldSuffixes, normalizeFieldName } from './document-fields.js';

export const defaultVocabulary = Object.freeze(
  Object.fromEntries(
    Object.entries({
      roles: [
        'менеджер',
        'директор',
        'руководитель',
        'инженер',
        'аналитик',
        'разработчик',
        'manager',
        'director',
        'engineer',
        'developer',
        'senior',
        'qa',
      ],
      organizationCues: [
        'компания',
        'компании',
        'холдинг',
        'банк',
        'группа компаний',
        'стартап',
      ],
      educationCues: [
        'образование',
        'вуз',
        'университет',
        'школа',
        'обучение',
        'колледж',
        'курсы',
        'диплом',
        'бакалавр',
        'graduated from',
      ],
      personalLabels: ['соискатель', 'сотрудник', 'кандидат'],
      personalFields: [
        'firstname',
        'lastname',
        'middlename',
        'patronymic',
        'candidatename',
        'displayname',
        'fullname',
        'originalfilename',
      ],
      personalAttributes: [],
    }).map(([key, values]) => [key, Object.freeze(values)])
  )
);
const cache = new Map();
const identities = new WeakMap();
const boundary = '[\\p{L}\\p{N}_]';
const name =
  '[\\p{Lu}][\\p{L}\\p{M}.-]{1,47}(?:[ \\t]+[\\p{Lu}][\\p{L}\\p{M}.-]{1,47}){0,3}';
const casedName = new RegExp(`^${name}`, 'u');
function normalizedLists(vocabulary) {
  if (vocabulary === undefined) {
    return undefined;
  }
  if (
    !vocabulary ||
    typeof vocabulary !== 'object' ||
    Array.isArray(vocabulary) ||
    Object.keys(vocabulary).some(
      (key) => !Object.hasOwn(defaultVocabulary, key)
    )
  ) {
    throw failure('ERR_CONFIG');
  }
  const lists = {};
  for (const [key, defaults] of Object.entries(defaultVocabulary)) {
    const input = vocabulary[key];
    if (input === undefined) {
      lists[key] = defaults;
      continue;
    }
    lists[key] = normalizedList(input, defaults);
  }
  return lists;
}
function normalizedList(input, defaults) {
  const values = Array.isArray(input) ? input : input?.values;
  const invalid =
    !Array.isArray(input) &&
    (input?.replace !== true ||
      Object.keys(input).some((k) => !['values', 'replace'].includes(k)));
  if (
    !Array.isArray(values) ||
    values.length > 256 ||
    invalid ||
    values.some(
      (s) =>
        typeof s !== 'string' ||
        !s.trim() ||
        s.length > 128 ||
        /[\r\n\0]/.test(s)
    )
  ) {
    throw failure('ERR_CONFIG');
  }
  return [
    ...new Set(
      [...(input.replace ? [] : defaults), ...values].map((s) =>
        s.normalize('NFC').trim().toLowerCase()
      )
    ),
  ];
}
// Caller stems for the strict special-category rule: each word matches at a
// word start and takes at most eight more letters of ending, like the built-in
// stems, so `узбеч` covers `узбечка` and `узбечкой`.
function attributePattern(values) {
  if (!values.length) {
    return undefined;
  }
  const stems = values
    .map((value) =>
      value
        .split(/\s+/u)
        .map(
          (word) =>
            `${escapePattern(word).replace(/[её]/gu, '[её]')}[\\p{L}\\p{M}]{0,8}`
        )
        .join('[ \\t]+')
    )
    .sort((a, b) => b.length - a.length)
    .join('|');
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])(?:${stems})(?![\\p{L}\\p{N}_])`,
    'giu'
  );
}
export function compiledVocabulary(vocabulary) {
  if (vocabulary === undefined) {
    return undefined;
  }
  const existing = identities.get(vocabulary);
  if (existing) {
    return existing;
  }
  const lists = normalizedLists(vocabulary);
  const key = JSON.stringify(lists);
  if (cache.has(key)) {
    const result = cache.get(key);
    identities.set(vocabulary, result);
    return result;
  }
  const alternatives = (values) =>
    values.length
      ? values
          .map((s) =>
            s
              .split(/\s+/u)
              .map((w) => wordPattern(w, 'ORGANIZATION'))
              .join('[ \\t]+')
          )
          .sort((a, b) => b.length - a.length)
          .join('|')
      : '(?!)';
  const result = { lists, patterns: [] };
  for (const [list, type] of [
    ['organizationCues', 'ORGANIZATION'],
    ['educationCues', 'EDUCATION'],
    ['personalLabels', 'PERSON'],
  ]) {
    const cue = alternatives(lists[list]);
    // Fold cues here and validate the captured name's casing at emission.
    const pattern = new RegExp(
      `(?<!${boundary})(${cue})[ \\t]*(?::|[-–—])?[ \\t]+(${name})(?!${boundary})`,
      'giu'
    );
    result.patterns.push({ type, pattern });
  }
  result.roles = new RegExp(
    `^(?:${alternatives(lists.roles)})(?!\\p{L})`,
    'iu'
  );
  result.rolePattern = new RegExp(
    `(?<!${boundary})(?:${alternatives(lists.roles)})[ \\t]+(?:в[ \\t]+)?(${name})(?!${boundary})`,
    'giu'
  );
  result.reverseRolePattern = new RegExp(
    `(?<!${boundary})(${name})[ \\t]*[:,–—-][ \\t]*(?:${alternatives(lists.roles)})(?!${boundary})`,
    'giu'
  );
  result.fields = new Set(lists.personalFields.map(normalizeFieldName));
  result.cues = new Set(
    [...lists.roles, ...lists.personalLabels].map((s) => s.replaceAll('ё', 'е'))
  );
  result.attributes = attributePattern(lists.personalAttributes);
  if (cache.size >= 64) {
    cache.clear();
  }
  cache.set(key, result);
  identities.set(vocabulary, result);
  return result;
}
export function vocabularyField(field, options) {
  const vocabulary = compiledVocabulary(options.vocabulary);
  if (!vocabulary) {
    return undefined;
  }
  return vocabulary.fields.has(normalizeFieldName(field)) ||
    fieldSuffixes(field).some((suffix) => vocabulary.fields.has(suffix))
    ? true
    : options.vocabulary.personalFields?.replace
      ? false
      : undefined;
}
export function detectVocabulary(text, emit, options) {
  const vocabulary = compiledVocabulary(options.vocabulary);
  if (!vocabulary) {
    return;
  }
  const emitName = (finding) => {
    const value = text.slice(finding.start, finding.end).match(casedName)?.[0];
    if (value && value !== 'REDACTED') {
      emit({ ...finding, end: finding.start + value.length });
    }
  };
  for (const { type, pattern } of vocabulary.patterns) {
    collectMatches(
      text,
      pattern,
      emitName,
      { type, category: 'personal', rule: 'vocabulary-cue', confidence: 0.85 },
      2,
      (value) => /^\p{Lu}/u.test(value) && value !== 'REDACTED'
    );
  }
  collectMatches(
    text,
    vocabulary.rolePattern,
    emitName,
    {
      type: 'ORGANIZATION',
      category: 'personal',
      rule: 'vocabulary-role',
      confidence: 0.8,
    },
    1,
    (value) => /^\p{Lu}/u.test(value) && value !== 'REDACTED'
  );
  collectMatches(
    text,
    vocabulary.reverseRolePattern,
    emitName,
    {
      type: 'ORGANIZATION',
      category: 'personal',
      rule: 'vocabulary-role',
      confidence: 0.8,
    },
    1,
    (value) => /^\p{Lu}/u.test(value) && value !== 'REDACTED'
  );
}
