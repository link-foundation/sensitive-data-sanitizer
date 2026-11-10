import { failure, REDACTED, escapePattern } from './detection.js';
import {
  namespacePattern,
  placeholderTokens,
  containsPlaceholder,
  escapedPlaceholderTokens,
} from './placeholder-types.js';
import { samePersonal } from './personal-variants.js';
import { isNameForm } from './russian-names.js';
import { nameAliases } from './transliteration.js';
import { createHash } from 'node:crypto';
import {
  createRestoreMap,
  validateRestoreMap,
  placeholderToken,
  documentDigest,
  validatePlaceholderFormat,
} from './restore-map.js';

export const placeholderState = Symbol('placeholder-state');
const placeholderNested = Symbol('placeholder-nested');
export const nestedPlaceholderOptions = (options) => ({
  ...options,
  [placeholderNested]: true,
});
export const hasPlaceholders = (options) =>
  [
    options.transformation,
    ...Object.values(options.transformations ?? {}),
  ].some((t) => t?.mode === 'placeholder');
export const placeholderValues = (options) =>
  (options[placeholderState]?.map.entries ?? []).map((entry) => ({
    value: entry.token,
    credential: entry.type === 'CREDENTIAL',
  }));
const transforms = (options) =>
  [
    options.transformation,
    ...Object.values(options.transformations ?? {}),
  ].filter((t) => t?.mode === 'placeholder');

const existingModes = new Set(['error', 'keep']);
export function validatePlaceholder(transform) {
  validatePlaceholderFormat(transform.format ?? transform.map?.format);
  if (
    transform.existing !== undefined &&
    !existingModes.has(transform.existing)
  ) {
    throw failure('ERR_CONFIG');
  }
  if (
    transform.credentials !== undefined &&
    typeof transform.credentials !== 'boolean'
  ) {
    throw failure('ERR_CONFIG');
  }
  if (transform.map !== undefined && transform.map !== false) {
    validateRestoreMap(transform.map);
    if (
      transform.format !== undefined &&
      transform.format !== transform.map.format
    ) {
      throw failure('ERR_CONFIG');
    }
  }
}
export function initializePlaceholders(options) {
  const selected = transforms(options);
  if (!selected.length || options[placeholderState]) {
    return options;
  }
  const first = selected[0];
  const map =
    first.map === false
      ? createRestoreMap({ format: first.format })
      : (first.map ?? createRestoreMap({ format: first.format }));
  if (
    selected.some(
      (t) =>
        (t.map !== undefined && t.map !== first.map) ||
        (t.format !== undefined && t.format !== map.format) ||
        (t.existing ?? 'error') !== (first.existing ?? 'error')
    )
  ) {
    throw failure('ERR_CONFIG');
  }
  return {
    ...options,
    [placeholderState]: {
      map,
      keep: first.map !== false,
      existing: first.existing ?? 'error',
      floors: new Map(),
    },
  };
}
export function placeholderKnown(options) {
  const map = options[placeholderState]?.map;
  if (!map) {
    return options;
  }
  return {
    ...options,
    confirmedPersonal: [
      ...(options.confirmedPersonal ?? []),
      ...map.entries
        .filter((entry) => entry.type !== 'CREDENTIAL')
        .flatMap((entry) =>
          (entry.type === 'PERSON' ? reusablePersonValues(entry) : entry.values)
            .filter((value) => value.length <= 256)
            .map((value) => ({
              type: entry.type,
              value,
              ...(entry.type === 'PERSON' && properCaseWord(value)
                ? { properCase: true }
                : {}),
            }))
        ),
    ],
  };
}
const singleWord = (value) => !/\s/u.test(value.trim());
const properCaseWord = (value) =>
  singleWord(value) && /^\p{Lu}/u.test(value.trim());
// A bare part recorded while replacing a fuller name in its own document is not
// evidence on its own in the next one, so a reused map offers only the full
// values, parts listed by the caller and values that were stored alone.
function reusablePersonValues(entry) {
  const longer = entry.values.filter((value) => !singleWord(value));
  return [
    ...new Set([
      ...entry.values.filter(
        (value) =>
          !singleWord(value) ||
          !longer.some((full) => partOfPerson(value, full))
      ),
      ...(entry.standalone ?? []),
    ]),
  ];
}
function partOfPerson(value, full) {
  return (
    related(
      value,
      { type: 'PERSON', aliases: aliases(full, 'PERSON') },
      true
    ) ||
    full
      .split(/\s+/u)
      .some((word) => word && samePersonal(value, word, 'PERSON'))
  );
}
const stem = (word) =>
  word.replace(
    /(?:овым|евым|овой|евой|ова|ева|ову|еву|ове|еве|ов|ев|ovym|evym|ovoi|evoi|ova|eva|ovu|evu|ove|eve|ov|ev)$/u,
    (ending) => (/^(?:ов|ov)/.test(ending) ? 'ov' : 'ev')
  );
function aliases(value, type) {
  if (type !== 'PERSON') {
    return [value.normalize('NFC').toLowerCase()];
  }
  return [
    ...new Set(
      nameAliases(value).map((v) => v.replace(/[\p{L}\p{M}]+/gu, stem))
    ),
  ];
}
// A bare name is the same entity as its numbered form, including maps saved
// when the span stopped at the hyphen of `Вектор-99`.
function numberedOrganization(value, entry) {
  return (entry.values ?? []).some((original) => {
    const base = original.replace(/-\d*$/u, '');
    return base !== original && samePersonal(value, base, entry.type);
  });
}
function wordsMatchAlias(words, full, parts) {
  if (words.length === 1) {
    return parts && words[0].length > 1 && full.includes(words[0]);
  }
  return (
    words.length > 1 &&
    words.length === full.length &&
    words.every(
      (part, i) =>
        part === full[i] || (part.length === 1 && full[i].startsWith(part))
    )
  );
}
// `parts` links a bare word to a fuller alias. Only callers that hold evidence
// from the current document may ask for it; a stored entry alone is not enough.
function related(value, entry, parts = false) {
  if (
    (entry.values ?? []).some((original) =>
      samePersonal(value, original, entry.type)
    )
  ) {
    return true;
  }
  const candidates = aliases(value, entry.type);
  if (candidates.some((alias) => entry.aliases.includes(alias))) {
    return true;
  }
  if (entry.type === 'ORGANIZATION') {
    return numberedOrganization(value, entry);
  }
  if (entry.type !== 'PERSON') {
    return false;
  }
  return candidates.some((candidate) => {
    const words = candidate.match(/[\p{L}\p{M}]+/gu) ?? [];
    return entry.aliases.some((alias) =>
      wordsMatchAlias(words, alias.match(/[\p{L}\p{M}]+/gu) ?? [], parts)
    );
  });
}
export function placeholderNameFindings(text, findings, options) {
  if (!hasPlaceholders(options) || options.knownOnly) {
    return findings;
  }
  const state = options[placeholderState];
  const patterns = new Set();
  // Bare surname forms need the full name in this document. A stored person
  // keeps only the initial form, which is itself a full mention.
  for (const person of [
    ...findings
      .filter((f) => f.type === 'PERSON')
      .map((f) => text.slice(f.start, f.end)),
    ...earlierPeople(options),
  ]) {
    addNamePatterns(person, patterns, true);
  }
  for (const entry of state?.map.entries ?? []) {
    if (entry.type === 'PERSON') {
      for (const person of entry.values) {
        addNamePatterns(person, patterns, false);
      }
    }
  }
  const result = [...findings];
  for (const pattern of patterns) {
    for (const match of text.matchAll(
      new RegExp(`(?<![\\p{L}\\p{M}])${pattern}(?![\\p{L}\\p{M}])`, 'giu')
    )) {
      result.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'PERSON',
        category: 'personal',
        rule: 'name-variant',
        confidence: 0.9,
      });
      if (result.length > (options.maxFindings ?? 100000)) {
        throw failure('ERR_LIMIT');
      }
    }
  }
  return result;
}
// Stream batches and decoded layers are pieces of the document being replaced.
function earlierPeople(options) {
  const state = options[placeholderState];
  return state?.stream || options[placeholderNested]
    ? (state?.people ?? [])
    : [];
}
const nameNeighbour = "\\p{Lu}[\\p{L}\\p{M}'’-]{1,31}";
const nameBefore = new RegExp(
  `(?<![\\p{L}\\p{M}\\p{N}_-])(${nameNeighbour})[ \\t]+$`,
  'u'
);
const nameAfter = new RegExp(
  `^[ \\t]+(${nameNeighbour})(?![\\p{L}\\p{M}\\p{N}_])`,
  'u'
);
const neighbourWindow = 64;
// `Алина` beside a bare `петрову` is the rest of that mention: replacing only the
// surname would leave that given name beside the token of the surname's owner.
export function coverAdjacentNames(text, findings, options) {
  if (!hasPlaceholders(options)) {
    return findings;
  }
  return findings.map((finding) => {
    if (
      finding.type !== 'PERSON' ||
      !singleWord(text.slice(finding.start, finding.end))
    ) {
      return finding;
    }
    let { start, end } = finding;
    // A given name and a patronymic can both stand on one side of a surname.
    for (let step = 0; step < 2; step++) {
      const before = nameBefore.exec(
        text.slice(Math.max(0, start - neighbourWindow), start)
      );
      if (before && isNameForm(before[1])) {
        start -= before[0].length;
      }
      const after = nameAfter.exec(text.slice(end, end + neighbourWindow));
      if (after && isNameForm(after[1])) {
        end += after[0].length;
      }
    }
    return start === finding.start && end === finding.end
      ? finding
      : { ...finding, start, end, rule: 'name-variant' };
  });
}
function addNamePatterns(person, patterns, bareForms) {
  const words = person.match(/[\p{L}\p{M}]+/gu) ?? [];
  if (words.length < 2 || words.some((word) => word.length < 2)) {
    return;
  }
  for (const alias of nameAliases(person)) {
    const parts = alias.match(/[\p{L}\p{M}]+/gu) ?? [];
    if (parts.length !== words.length) {
      continue;
    }
    patterns.add(
      `${escapePattern(parts[0][0])}\\.[ \\t]+${parts.slice(1).map(escapePattern).join('[ \\t]+')}`
    );
    for (const word of bareForms ? parts : []) {
      if (/^[а-яё]+(?:ов|ев)$/u.test(word)) {
        patterns.add(`${escapePattern(word)}(?:ым|ой|а|у|е|ы|ых|ами)?`);
      }
    }
  }
}
const placeholderType = (finding) => {
  if (finding.category === 'credential') {
    return 'CREDENTIAL';
  }
  const type =
    finding.type === 'JSON_VALUE'
      ? (finding.valueType ?? 'SENSITIVE')
      : finding.type;
  return type === 'DATE_OF_BIRTH' ? 'DATE' : type;
};
// Types beyond the reserved list that this call can turn into tokens.
function callPattern(findings, options) {
  const transform = transforms(options)[0];
  const map = options[placeholderState]?.map;
  return namespacePattern(
    map?.format ?? transform?.format ?? transform?.map?.format,
    [
      ...findings.map(placeholderType),
      ...(options.knownPersonal ?? []).map((e) => e.type),
      ...(map?.entries ?? []).map((e) => e.type),
    ]
  );
}
const keepsExisting = (options) => transforms(options)[0]?.existing === 'keep';
// With `existing: 'keep'` the tokens of an earlier pass stay as they are, so
// findings made only of those tokens are not replaced again.
export function keptPlaceholderSpans(text, findings, options) {
  if (!keepsExisting(options) || !mayHavePlaceholder(text, options)) {
    return [];
  }
  return placeholderTokens(text, callPattern(findings, options));
}
// Every default token contains a hyphen and a positive counter. This cheap
// precheck stays linear even on long alphabetic text. Escapes and custom
// formats conservatively keep the full scan.
function mayHavePlaceholder(text, options) {
  const transform = transforms(options)[0];
  const format =
    options[placeholderState]?.map?.format ??
    transform?.format ??
    transform?.map?.format;
  return (
    (format !== undefined && format !== '{Type}-{n}') ||
    text.includes('\\') ||
    /-[1-9]/.test(text)
  );
}
const significant = /[\p{L}\p{N}]/u;
// A finding made only of kept tokens is kept, and one that starts or ends
// inside a kept token is trimmed to the text beside it.
function trimmedToLoose(finding, inside, loose) {
  let { start, end } = finding;
  if (inside(start)) {
    while (start < end && !loose(start)) {
      start = inside(start)?.end ?? start + 1;
    }
  }
  if (inside(end - 1)) {
    while (end > start && !loose(end - 1)) {
      end = inside(end - 1)?.start ?? end - 1;
    }
  }
  return start === finding.start && end === finding.end
    ? finding
    : { ...finding, start, end };
}
export function keptPlaceholderFinding(text, finding, tokens) {
  const overlapping = tokens.filter(
    (token) => token.start < finding.end && token.end > finding.start
  );
  if (finding.category !== 'personal' || !overlapping.length) {
    return finding;
  }
  const inside = (i) =>
    overlapping.find((token) => token.start <= i && token.end > i);
  const loose = (i) => !inside(i) && significant.test(text[i]);
  const { start, end } = finding;
  if (!Array.from({ length: end - start }, (_, i) => start + i).some(loose)) {
    return { ...finding, kept: 'fake' };
  }
  return finding.type === 'JSON_VALUE'
    ? finding
    : trimmedToLoose(finding, inside, loose);
}
export function preparePlaceholderText(text, findings, options) {
  const state = options[placeholderState];
  if (!state || !hasPlaceholders(options)) {
    return;
  }
  const pattern = callPattern(findings, options);
  if (state.existing === 'keep') {
    // New values are numbered after the highest kept number of their type.
    for (const token of !mayHavePlaceholder(text, options)
      ? []
      : [
          ...placeholderTokens(text, pattern),
          ...escapedPlaceholderTokens(text, pattern),
        ]) {
      for (const type of token.types) {
        state.floors.set(
          type,
          Math.max(state.floors.get(type) ?? 0, token.number)
        );
      }
    }
  } else if (namespaceCollision(text, pattern)) {
    throw failure('ERR_PLACEHOLDER_COLLISION');
  }
  state.people = [
    ...new Set([
      ...earlierPeople(options),
      ...findings
        .filter((f) => f.type === 'PERSON')
        .map((f) => text.slice(f.start, f.end)),
      ...(options.knownPersonal ?? [])
        .filter((e) => e.type === 'PERSON')
        .map((e) => e.value),
    ]),
  ];
}
function namespaceCollision(text, pattern) {
  // JSON escape spellings must not conceal existing tokens in keys or values.
  return (
    containsPlaceholder(text, pattern) ||
    escapedPlaceholderTokens(text, pattern).length > 0
  );
}

export function canonicalPerson(value, people) {
  // Resolve components only when there is a unique compatible full name.
  const matches = people.filter((person) => {
    const words = person.match(/\p{L}+/gu) ?? [];
    return (
      words.length > 1 &&
      words.every((word) => word.length > 1) &&
      related(
        value,
        { type: 'PERSON', aliases: aliases(person, 'PERSON') },
        true
      )
    );
  });
  const distinct = new Map(
    matches.map((person) => [
      aliases(person, 'PERSON').sort().join('\0'),
      person,
    ])
  );
  if (distinct.size === 1) {
    return [...distinct.values()][0];
  }
  // `Иванов Иван` and `Иванов Иван Петрович` are one mention in two lengths:
  // the unique name that holds the words of every other match is the person.
  const words = (person) =>
    new Set((person.match(/\p{L}+/gu) ?? []).map((w) => w.toLowerCase()));
  const fullest = [...distinct.values()].filter((person) => {
    const own = words(person);
    return matches.every((other) => [...words(other)].every((w) => own.has(w)));
  });
  return fullest.length === 1 ? fullest[0] : value;
}
function canonicalKnown(value, type, options, state) {
  const known = (options.knownPersonal ?? []).filter(
    (e) => e.type === type && samePersonal(value, e.value, type)
  );
  // `Петров Данил` and `Петров Данил Сергеевич` are one person: the fullest wins.
  const longest = Math.max(0, ...known.map((e) => e.value.length));
  const fullest = known.filter((e) => e.value.length === longest);
  const listed = fullest.length === 1 ? fullest[0].value : value;
  if (type !== 'PERSON') {
    return listed;
  }
  // The caller's list names each person once, while the document may hold the
  // same full name in several cases, so the list settles a listed part first.
  const named = canonicalPerson(
    listed,
    (options.knownPersonal ?? [])
      .filter((e) => e.type === 'PERSON')
      .map((e) => e.value)
  );
  return named === listed ? canonicalPerson(listed, state.people ?? []) : named;
}
// A part the caller listed is stored as its own value, unlike a part that was
// only recorded as a surface of a longer name.
function rememberListedParts(entry, value, options) {
  for (const known of options.knownPersonal ?? []) {
    if (
      known.type === 'PERSON' &&
      singleWord(known.value) &&
      samePersonal(value, known.value, 'PERSON') &&
      !entry.standalone?.includes(known.value)
    ) {
      (entry.standalone ??= []).push(known.value);
    }
  }
}
export function placeholderReplacement(value, finding, transform, options) {
  if (finding.category === 'credential' && !transform.credentials) {
    return REDACTED;
  }
  const state = options[placeholderState];
  if (!state) {
    throw failure('ERR_CONFIG');
  }
  const { map } = state;
  const type = placeholderType(finding);
  const canonical = canonicalKnown(value, type, options, state);
  const candidates = map.entries.filter(
    (entry) => entry.type === type && related(canonical, entry)
  );
  // Several related entities are ambiguous, unless one holds this exact value.
  const exact = candidates.filter((entry) =>
    entry.values.some((original) => samePersonal(canonical, original, type))
  );
  const matches = candidates.length === 1 ? candidates : exact;
  let entry = matches.length === 1 ? matches[0] : undefined;
  if (!entry) {
    if (map.entries.length >= (options.maxFindings ?? 100000)) {
      throw failure('ERR_LIMIT');
    }
    const number =
      1 +
      map.entries.reduce(
        (n, e) => (e.type === type ? Math.max(n, e.number) : n),
        state.floors?.get(type) ?? 0
      );
    const token = placeholderToken(type, number, map.format);
    if (
      !Number.isSafeInteger(number) ||
      map.entries.some((e) => e.token === token)
    ) {
      throw failure('ERR_PLACEHOLDER_COLLISION');
    }
    entry = {
      type,
      number,
      token,
      values: [canonical],
      aliases: aliases(canonical, type),
    };
    map.entries.push(entry);
  }
  if (!entry.values.includes(value)) {
    entry.values.push(value);
  }
  if (type === 'PERSON') {
    rememberListedParts(entry, value, options);
  }
  return entry.token;
}
export function finishPlaceholders(result, occurrences, options) {
  const state = options[placeholderState];
  if (!state?.keep || !hasPlaceholders(options)) {
    return result;
  }
  if (options[placeholderNested]) {
    return { ...result, map: state.map };
  } else if (state.stream) {
    state.stream.add(result.text, occurrences);
  } else {
    addDocument(state.map, documentDigest(result.text), occurrences);
  }
  return { ...result, map: state.map };
}
function addDocument(map, digest, occurrences) {
  const existing = map.documents.find((doc) => doc.digest === digest);
  if (existing) {
    if (JSON.stringify(existing.occurrences) !== JSON.stringify(occurrences)) {
      throw failure('ERR_RESTORE_AMBIGUITY');
    }
    return;
  }
  if (map.documents.length >= 100000) {
    throw failure('ERR_LIMIT');
  }
  map.documents.push({ digest, occurrences });
}
// Hash the whole output incrementally; retain only bounded restoration spans.
export function beginPlaceholderStream(options) {
  const state = options[placeholderState];
  if (!state || state.stream) {
    return () => {};
  }
  const hash = createHash('sha256'),
    occurrences = [];
  let offset = 0;
  state.stream = {
    add(text, spans) {
      hash.update(text);
      for (const span of spans) {
        if (occurrences.length >= (options.maxFindings ?? 100000)) {
          throw failure('ERR_LIMIT');
        }
        occurrences.push({
          ...span,
          start: span.start + offset,
          end: span.end + offset,
        });
      }
      offset += text.length;
    },
  };
  return (complete) => {
    state.stream = undefined;
    if (complete && state.keep) {
      addDocument(state.map, hash.digest('hex'), occurrences);
    }
    discardPlaceholderState(options);
  };
}
export function discardPlaceholderState(options) {
  const state = options[placeholderState];
  if (state && !state.keep && !state.stream) {
    state.map.entries.length = 0;
    state.map.documents.length = 0;
    state.people = [];
    state.floors?.clear();
  }
}
