import { Parser } from 'links-notation';
import { decode, encode, isCompactNotation } from 'lino-objects-codec';
import { failure } from './detection.js';

export function encodeLinoObject(object) {
  return `${encode({ obj: serializableTree(object) })}\n`;
}

// Reports use optional properties, which were omitted by the JSON writer.
function serializableTree(value) {
  if (Array.isArray(value)) {
    return value.map((item) => serializableTree(item ?? null));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .map(([key, child]) => [key, serializableTree(child)])
    );
  }
  return value;
}

// Limit nesting before using the object codec's recursive reader. Restrict
// external files to plain trees so compact object graphs cannot enter policy.
export function decodeLinoObject(text, maxBytes) {
  if (Buffer.byteLength(text) > maxBytes || isCompactNotation(text)) {
    throw failure('ERR_CONFIG');
  }
  new Parser({
    comments: false,
    maxDepth: 32,
    maxInputSize: maxBytes,
    syntax: false,
  }).parseGroups(text);
  const object = decode({ notation: text });
  if (!object || typeof object !== 'object' || Array.isArray(object)) {
    throw failure('ERR_CONFIG');
  }
  checkPlainTree(object);
  return object;
}

function checkPlainTree(value) {
  if (!value || typeof value !== 'object') {
    if (
      value === undefined ||
      (typeof value === 'number' && !Number.isFinite(value))
    ) {
      throw failure('ERR_CONFIG');
    }
    return;
  }
  if (
    Object.getPrototypeOf(value) !==
    (Array.isArray(value) ? Array.prototype : Object.prototype)
  ) {
    throw failure('ERR_CONFIG');
  }
  for (const child of Object.values(value)) {
    checkPlainTree(child);
  }
}
