import { failure } from './detection.js';
import { personalRegex } from './personal-variants.js';
import { projectText } from './projection.js';

// Caller-owned frozen arrays remain compatible with maps, streams and fakes.
// Weak keys allow the caller to release all values and compiled expressions.
const compiled = new WeakMap();
export const isCompiledKnown = (entries) => compiled.has(entries);
export const compiledPatterns = (entries) => compiled.get(entries)?.patterns;
export const projectedKnown = (entries) => compiled.get(entries)?.projected;

export function compileKnown(...lists) {
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
      (entry.properCase !== undefined && typeof entry.properCase !== 'boolean')
    ) {
      throw failure('ERR_CONFIG');
    }
    const copy = Object.freeze({
      type: entry.type,
      value: entry.value,
      ...(entry.properCase === undefined
        ? {}
        : { properCase: entry.properCase }),
    });
    values.set(
      `${entry.type}\0${entry.value}\0${entry.properCase ?? false}`,
      copy
    );
  }
  const entries = Object.freeze([...values.values()]);
  const patterns = entries.map((entry) =>
    personalRegex(entry.value, entry.type)
  );
  const projected = entries.map((entry) => ({
    ...entry,
    value: projectText(entry.value).text,
  }));
  const changed = projected.some(
    (entry, i) => entry.value !== entries[i].value
  );
  compiled.set(entries, {
    patterns,
    projected: changed ? compileKnown(projected) : entries,
  });
  return entries;
}
