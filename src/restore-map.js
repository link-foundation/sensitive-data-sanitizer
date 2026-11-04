import { createHash } from 'node:crypto';
import { Parser, Link } from 'links-notation';
import { failure, escapePattern } from './detection.js';
import { atomicWrite, readTextFile } from './files.js';

export const restoreMapKind = 'sensitive-data-restore-map';
export const documentDigest = (text) =>
  createHash('sha256').update(text).digest('hex');
const defaultFormat = '{Type}-{n}';
export function validatePlaceholderFormat(format = defaultFormat) {
  if (
    typeof format !== 'string' ||
    format.length > 128 ||
    !/\{(?:Type|TYPE|type)\}/.test(format) ||
    !format.includes('{n}') ||
    /[\r\n\0]/.test(format) ||
    (format.match(/\{n\}/g) ?? []).length !== 1 ||
    (format.match(/\{(?:Type|TYPE|type)\}/g) ?? []).length !== 1 ||
    /[{}]/.test(
      format
        .replace(/\{(?:Type|TYPE|type|n)\}/g, '')
        .replaceAll('{{', '')
        .replaceAll('}}', '')
    )
  ) {
    throw failure('ERR_CONFIG');
  }
  return format;
}
export function placeholderToken(type, number, format = defaultFormat) {
  const title = type
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('');
  return format.replace(
    /\{(Type|TYPE|type|n)\}/g,
    (_, key) =>
      ({
        Type: title,
        TYPE: type,
        type: type.toLowerCase(),
        n: String(number),
      })[key]
  );
}
export function createRestoreMap({ format = defaultFormat } = {}) {
  return {
    kind: restoreMapKind,
    version: 1,
    format: validatePlaceholderFormat(format),
    entries: [],
    documents: [],
  };
}
export function validateRestoreMap(map) {
  if (
    !map ||
    map.kind !== restoreMapKind ||
    map.version !== 1 ||
    !Array.isArray(map.entries) ||
    !Array.isArray(map.documents) ||
    map.entries.length > 100000 ||
    map.documents.length > 100000
  ) {
    throw failure('ERR_MAP');
  }
  validatePlaceholderFormat(map.format);
  validateEntries(map);
  for (const doc of map.documents) {
    validateDocument(doc);
  }
  return map;
}
function validateEntries(map) {
  const tokens = new Set();
  for (const entry of map.entries) {
    if (
      !entry ||
      !/^[A-Z][A-Z0-9_]{0,63}$/.test(entry.type) ||
      !Number.isSafeInteger(entry.number) ||
      entry.number < 1 ||
      entry.token !== placeholderToken(entry.type, entry.number, map.format) ||
      tokens.has(entry.token) ||
      !nonemptyStrings(entry.values) ||
      !Array.isArray(entry.aliases) ||
      entry.aliases.some((v) => typeof v !== 'string' || !v)
    ) {
      throw failure('ERR_MAP');
    }
    tokens.add(entry.token);
  }
}
function nonemptyStrings(values) {
  return (
    Array.isArray(values) &&
    values.length > 0 &&
    values.every((v) => typeof v === 'string' && v.length > 0)
  );
}
function validateDocument(doc) {
  if (
    !doc ||
    !/^[a-f0-9]{64}$/.test(doc.digest) ||
    !Array.isArray(doc.occurrences)
  ) {
    throw failure('ERR_MAP');
  }
  let end = 0;
  for (const occurrence of doc.occurrences) {
    if (
      !occurrence ||
      !Number.isSafeInteger(occurrence.start) ||
      occurrence.start < end ||
      !Number.isSafeInteger(occurrence.end) ||
      occurrence.end <= occurrence.start ||
      typeof occurrence.raw !== 'string' ||
      typeof occurrence.token !== 'string' ||
      !occurrence.token ||
      occurrence.end - occurrence.start !== occurrence.token.length
    ) {
      throw failure('ERR_MAP');
    }
    end = occurrence.end;
  }
}

export function serializeRestoreMap(map, format = 'json') {
  validateRestoreMap(map);
  if (format === 'json') {
    return `${JSON.stringify(map, null, 2)}\n`;
  }
  if (format !== 'lino') {
    throw failure('ERR_CONFIG');
  }
  // Let the upstream formatter handle quotes, slashes, newlines and Unicode.
  return `${new Link(restoreMapKind, [new Link(JSON.stringify(map))]).toString()}\n`;
}
export function parseRestoreMap(text) {
  try {
    if (
      typeof text !== 'string' ||
      Buffer.byteLength(text) > 32 * 1024 * 1024
    ) {
      throw failure('ERR_MAP');
    }
    if (text.trimStart().startsWith('{')) {
      return validateRestoreMap(JSON.parse(text));
    }
    const links = new Parser({
      maxInputSize: 32 * 1024 * 1024,
      maxDepth: 8,
    }).parse(text);
    if (
      links.length !== 1 ||
      links[0].id !== restoreMapKind ||
      links[0].values.length !== 1 ||
      links[0].values[0].values.length
    ) {
      throw failure('ERR_MAP');
    }
    return validateRestoreMap(JSON.parse(links[0].values[0].id));
  } catch {
    throw failure('ERR_MAP');
  }
}
export const readRestoreMap = async (path) =>
  parseRestoreMap(await readTextFile(path, 32 * 1024 * 1024));
export async function writeRestoreMap(
  path,
  map,
  { format = path.endsWith('.lino') ? 'lino' : 'json', replace = false } = {}
) {
  await atomicWrite(path, serializeRestoreMap(map, format), { replace });
}
export function rejectRestoreMap(text) {
  if (
    /"kind"\s*:\s*"sensitive-data-restore-map"|\(["\x27`]?sensitive-data-restore-map["\x27`]?\s*:/.test(
      text
    )
  ) {
    throw failure('ERR_PRIVATE_MAP');
  }
}
export function restore(text, map) {
  if (typeof text !== 'string') {
    throw failure('ERR_INPUT');
  }
  validateRestoreMap(map);
  const document = map.documents.find(
    (doc) => doc.digest === documentDigest(text)
  );
  if (document) {
    let cursor = 0;
    const parts = [];
    for (const occurrence of document.occurrences) {
      if (text.slice(occurrence.start, occurrence.end) !== occurrence.token) {
        throw failure('ERR_MAP');
      }
      parts.push(text.slice(cursor, occurrence.start), occurrence.raw);
      cursor = occurrence.end;
    }
    return parts.join('') + text.slice(cursor);
  }
  const entries = new Map(
    map.entries.map((entry) => [entry.token, entry.values[0]])
  );
  if (!entries.size) {
    return text;
  }
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(?:${[...entries.keys()]
      .sort((a, b) => b.length - a.length)
      .map(escapePattern)
      .join('|')})(?![\\p{L}\\p{N}_-])`,
    'gu'
  );
  return text.replace(pattern, (token) => entries.get(token));
}
