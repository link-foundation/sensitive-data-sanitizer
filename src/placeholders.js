import { failure, REDACTED, escapePattern } from './detection.js';
import { nameAliases } from './transliteration.js';
import { createHash } from 'node:crypto';
import { jsonStringLiterals } from './json-string-runs.js';
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

export function validatePlaceholder(transform) {
  validatePlaceholderFormat(transform.format ?? transform.map?.format);
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
        (t.format !== undefined && t.format !== map.format)
    )
  ) {
    throw failure('ERR_CONFIG');
  }
  return { ...options, [placeholderState]: { map, keep: first.map !== false } };
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
          entry.values
            .filter((value) => value.length <= 256)
            .map((value) => ({ type: entry.type, value }))
        ),
    ],
  };
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
function related(value, entry) {
  const candidates = aliases(value, entry.type);
  if (candidates.some((alias) => entry.aliases.includes(alias))) {
    return true;
  }
  if (entry.type !== 'PERSON') {
    return false;
  }
  for (const candidate of candidates) {
    const parts = candidate.match(/[\p{L}\p{M}]+/gu) ?? [];
    for (const alias of entry.aliases) {
      const full = alias.match(/[\p{L}\p{M}]+/gu) ?? [];
      if (
        parts.length === 1 &&
        parts[0].length > 1 &&
        full.includes(parts[0])
      ) {
        return true;
      }
      if (
        parts.length === full.length &&
        parts.length > 1 &&
        parts.every(
          (part, i) =>
            part === full[i] || (part.length === 1 && full[i].startsWith(part))
        )
      ) {
        return true;
      }
    }
  }
  return false;
}
export function placeholderNameFindings(text, findings, options) {
  if (!hasPlaceholders(options)) {
    return findings;
  }
  const people = [
    ...findings
      .filter((f) => f.type === 'PERSON')
      .map((f) => text.slice(f.start, f.end)),
    ...(options[placeholderState]?.map.entries ?? [])
      .filter((e) => e.type === 'PERSON')
      .flatMap((e) => e.values),
  ];
  const patterns = new Set();
  for (const person of people) {
    addNamePatterns(person, patterns);
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
function addNamePatterns(person, patterns) {
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
    for (const word of parts) {
      if (/^[а-яё]+(?:ов|ев)$/u.test(word)) {
        patterns.add(`${escapePattern(word)}(?:ым|ой|а|у|е|ы|ых|ами)?`);
      }
    }
  }
}
export function preparePlaceholderText(text, findings, options) {
  const state = options[placeholderState];
  if (!state || !hasPlaceholders(options)) {
    return;
  }
  // Reserve the entire namespace, not only the numbers about to be allocated.
  const template = state.map.format;
  const pattern = new RegExp(
    escapePattern(template)
      .replace(/\\\{(?:Type|TYPE|type)\\\}/, '[A-Za-z][A-Za-z0-9_]*')
      .replace('\\{n\\}', '[1-9][0-9]*'),
    'u'
  );
  if (namespaceCollision(text, pattern)) {
    throw failure('ERR_PLACEHOLDER_COLLISION');
  }
  const people = findings
    .filter((f) => f.type === 'PERSON')
    .map((f) => text.slice(f.start, f.end));
  state.people = [
    ...people,
    ...state.map.entries
      .filter((e) => e.type === 'PERSON')
      .flatMap((e) => e.values),
  ];
}
function namespaceCollision(text, pattern) {
  if (pattern.test(text)) {
    return true;
  }
  // JSON escape spellings must not conceal existing tokens in keys or values.
  for (const literal of jsonStringLiterals(text)) {
    try {
      if (pattern.test(JSON.parse(literal))) {
        return true;
      }
    } catch {
      // Ordinary free text may include strings that are not JSON literals.
    }
  }
  return false;
}

function canonicalPerson(value, people) {
  // Resolve components only when there is a unique compatible full name.
  const matches = people.filter((person) => {
    const words = person.match(/\p{L}+/gu) ?? [];
    return (
      words.length > 1 &&
      words.every((word) => word.length > 1) &&
      related(value, { type: 'PERSON', aliases: aliases(person, 'PERSON') })
    );
  });
  const distinct = new Map(
    matches.map((person) => [
      aliases(person, 'PERSON').sort().join('\0'),
      person,
    ])
  );
  return distinct.size === 1 ? [...distinct.values()][0] : value;
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
  const type =
    finding.category === 'credential'
      ? 'CREDENTIAL'
      : finding.type === 'DATE_OF_BIRTH'
        ? 'DATE'
        : finding.type;
  const canonical =
    type === 'PERSON' ? canonicalPerson(value, state.people ?? []) : value;
  const candidates = map.entries.filter(
    (entry) => entry.type === type && related(canonical, entry)
  );
  let entry = candidates.length === 1 ? candidates[0] : undefined;
  if (!entry) {
    if (map.entries.length >= (options.maxFindings ?? 100000)) {
      throw failure('ERR_LIMIT');
    }
    const number =
      1 +
      map.entries.reduce(
        (n, e) => (e.type === type ? Math.max(n, e.number) : n),
        0
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
  }
}
