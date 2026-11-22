import { failure } from './detection.js';
import { createMatcher } from './known-matcher.js';
import { personalSource, sourceRegex } from './personal-variants.js';
import { projectText } from './projection.js';

// Caller-owned frozen arrays remain compatible with maps, streams and fakes.
// Weak keys allow the caller to release all values and compiled expressions.
const compiled = new WeakMap();
export const isCompiledKnown = (entries) => compiled.has(entries);
export const projectedKnown = (entries) => compiled.get(entries)?.projected;

// Per-entry matching options, also accepted as compileKnown
// defaults for entries that do not set them.
export const entryFlags = ['properCase', 'identifiers', 'transliterate'];
const compileOptions = new Set(['warm', ...entryFlags]);

const buildMatcher = (entries) =>
  createMatcher(
    entries,
    (entry) => personalSource(entry.value, entry.type, entry),
    (entry, source, sticky) => sourceRegex(source, entry.type, entry, sticky)
  );

/**
 * The prefilter and lazily compiled expressions of a known list.
 * Compiled lists keep theirs; a plain array gets a matcher for one call.
 */
export const knownMatcher = (entries) =>
  compiled.get(entries)?.matcher ?? buildMatcher(entries);

function readOptions(lists) {
  const last = lists.at(-1);
  if (last === undefined || Array.isArray(last)) {
    return { lists, options: {} };
  }
  if (
    last === null ||
    typeof last !== 'object' ||
    Object.keys(last).some(
      (key) => !compileOptions.has(key) || typeof last[key] !== 'boolean'
    )
  ) {
    throw failure('ERR_CONFIG');
  }
  return { lists: lists.slice(0, -1), options: last };
}

export function compileKnown(...args) {
  const { lists, options } = readOptions(args);
  if (lists.some((list) => !Array.isArray(list))) {
    throw failure('ERR_CONFIG');
  }
  const values = new Map();
  for (const entry of lists.flat()) {
    if (
      !entry ||
      typeof entry.value !== 'string' ||
      !entry.value ||
      !/^[A-Z][A-Z0-9_]{0,63}$/.test(entry.type) ||
      entryFlags.some(
        (flag) => entry[flag] !== undefined && typeof entry[flag] !== 'boolean'
      )
    ) {
      throw failure('ERR_CONFIG');
    }
    const copy = { type: entry.type, value: entry.value };
    for (const flag of entryFlags) {
      const value = entry[flag] ?? options[flag];
      if (value !== undefined) {
        copy[flag] = value;
      }
    }
    values.set(
      [
        entry.type,
        entry.value,
        // Undefined enables the default surname policy; false opts out.
        ...entryFlags.map((flag) =>
          flag === 'properCase' ? copy[flag] : (copy[flag] ?? false)
        ),
      ].join('\0'),
      Object.freeze(copy)
    );
  }
  const entries = Object.freeze([...values.values()]);
  const matcher = buildMatcher(entries);
  if (options.warm) {
    matcher.warm();
  }
  const projected = entries.map((entry) => ({
    ...entry,
    value: projectText(entry.value).text,
  }));
  const changed = projected.some(
    (entry, i) => entry.value !== entries[i].value
  );
  compiled.set(entries, {
    matcher,
    projected: changed
      ? compileKnown(projected, options.warm ? { warm: true } : {})
      : entries,
  });
  return entries;
}
