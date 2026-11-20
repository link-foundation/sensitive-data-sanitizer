import { TextDecoder } from 'node:util';
import { failure } from './detection.js';
import { validateRestoreMap } from './restore-map.js';

const word = /[\p{L}\p{M}\p{N}_]/u;
const rightWord = /[\p{L}\p{M}\p{N}_-]/u;
const highSurrogate = /[\uD800-\uDBFF]/u;

function trie(entries) {
  const root = { children: new Map() };
  for (const { token, values, type } of entries) {
    if (type === 'CREDENTIAL') {
      continue;
    }
    let node = root;
    for (const unit of token.split('')) {
      if (!node.children.has(unit)) {
        node.children.set(unit, { children: new Map() });
      }
      node = node.children.get(unit);
    }
    node.replacement = { value: values[0], last: Array.from(token).at(-1) };
  }
  return root;
}

function match(root, text, start, end, final) {
  let node = root;
  let replacement;
  for (let cursor = start; cursor < end;) {
    node = node.children.get(text[cursor++]);
    if (!node) {
      break;
    }
    if (cursor === end && !final) {
      return null; // More input could extend the token or change its boundary.
    }
    const next = text.codePointAt(cursor);
    if (
      node.replacement !== undefined &&
      (next === undefined || !rightWord.test(String.fromCodePoint(next)))
    ) {
      replacement = { end: cursor, ...node.replacement };
    }
  }
  return replacement;
}

function createCursor(
  root,
  { encoding, maxChunkUnits, maxInputUnits, maxOutputUnits, signal }
) {
  const decoder =
    encoding === 'utf8'
      ? new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
      : undefined;
  let pending = '';
  let previous = '';
  let inputUnits = 0;
  let outputUnits = 0;
  let closed = false;

  function cancel() {
    pending = '';
    closed = true;
  }
  function emit(parts, text) {
    outputUnits += text.length;
    if (outputUnits > maxOutputUnits) {
      throw failure('ERR_LIMIT');
    }
    parts.push(text);
  }
  function consume(chunk, final) {
    const text = pending + chunk;
    const end =
      !final && highSurrogate.test(text.at(-1) ?? '')
        ? text.length - 1
        : text.length;
    const parts = [];
    let cursor = 0;
    let literalStart = 0;
    while (cursor < end) {
      const token = word.test(previous)
        ? undefined
        : match(root, text, cursor, end, final);
      if (token === null) {
        break;
      }
      if (token) {
        emit(parts, text.slice(literalStart, cursor));
        emit(parts, token.value);
        cursor = token.end;
        literalStart = cursor;
        previous = token.last;
      } else {
        previous = String.fromCodePoint(text.codePointAt(cursor));
        cursor += previous.length;
      }
    }
    emit(parts, text.slice(literalStart, cursor));
    pending = text.slice(cursor);
    return parts.join('');
  }

  function read(chunk, final) {
    if (decoder ? !(chunk instanceof Uint8Array) : typeof chunk !== 'string') {
      throw failure('ERR_INPUT');
    }
    inputUnits += chunk.length;
    if (chunk.length > maxChunkUnits || inputUnits > maxInputUnits) {
      throw failure('ERR_LIMIT');
    }
    try {
      return decoder ? decoder.decode(chunk, { stream: !final }) : chunk;
    } catch {
      throw failure('ERR_INPUT');
    }
  }

  function process(chunk, final) {
    try {
      if (signal?.aborted) {
        throw failure('ERR_ABORT');
      }
      if (closed) {
        throw failure('ERR_STATE');
      }
      const result = consume(read(chunk, final), final);
      if (final) {
        cancel();
      }
      return result;
    } catch (error) {
      cancel();
      throw error;
    }
  }
  return {
    write: (chunk) => process(chunk, false),
    finish: () => process(decoder ? new Uint8Array() : '', true),
    cancel,
  };
}

/** Snapshot one trusted map. Open a separate cursor for each logical field. */
export function createStreamingRestorer(
  map,
  {
    maxEntries = 4096,
    maxMapUnits = 1024 * 1024,
    maxChunkUnits = 64 * 1024,
    maxInputUnits = 1024 * 1024,
    maxOutputUnits = 2 * 1024 * 1024,
  } = {}
) {
  if (
    [
      maxEntries,
      maxMapUnits,
      maxChunkUnits,
      maxInputUnits,
      maxOutputUnits,
    ].some((value) => !Number.isSafeInteger(value) || value <= 0)
  ) {
    throw failure('ERR_CONFIG');
  }
  if (Array.isArray(map?.entries) && map.entries.length > maxEntries) {
    throw failure('ERR_LIMIT');
  }
  // Derived replies only use canonical entries. Exact document occurrences
  // can contain raw structured escapes and are intentionally never read here.
  const { entries } = validateRestoreMap({ ...map, documents: [] });
  let units = 0;
  for (const entry of entries) {
    units += entry.token.length + entry.values[0].length;
    if (units > maxMapUnits) {
      throw failure('ERR_LIMIT');
    }
  }
  const root = trie(entries);
  return {
    open({ encoding = 'text', signal } = {}) {
      if (encoding !== 'text' && encoding !== 'utf8') {
        throw failure('ERR_CONFIG');
      }
      return createCursor(root, {
        encoding,
        maxChunkUnits,
        maxInputUnits,
        maxOutputUnits,
        signal,
      });
    },
  };
}
