// Map a detection view back to the original UTF-16 offsets. Normalization
// never writes to the original text, and offsets remain valid after emoji.
import { failure } from './detection.js';

// Unicode Nd zero codepoints. NFKC already maps mathematical/fullwidth digits;
// other numeral systems need explicit conversion with original-source spans.
const digitZeros = [
  0x30, 0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66,
  0xce6, 0xd66, 0xde6, 0xe50, 0xed0, 0xf20, 0x1040, 0x1090, 0x17e0, 0x1810,
  0x1946, 0x19d0, 0x1a80, 0x1a90, 0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa620,
  0xa8d0, 0xa900, 0xa9d0, 0xa9f0, 0xaa50, 0xabf0, 0x104a0, 0x10d30, 0x11066,
  0x110f0, 0x11136, 0x111d0, 0x112f0, 0x11450, 0x114d0, 0x11650, 0x116c0,
  0x11730, 0x118e0, 0x11950, 0x11c50, 0x11d50, 0x11da0, 0x16a60, 0x16ac0,
  0x16b50, 0x1e140, 0x1e2f0, 0x1e950, 0x1fbf0,
];
function asciiDigits(value) {
  return value.replace(/\p{Nd}/gu, (digit) => {
    const code = digit.codePointAt(0);
    const zero = digitZeros.find((start) => code >= start && code <= start + 9);
    return zero === undefined ? digit : String(code - zero);
  });
}

export function projectText(input) {
  if (
    // eslint-disable-next-line no-control-regex -- ANSI escape sequences are removed from the detection view.
    !/\x1b\[|\\u[\da-fA-F]{4}|[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(
      input
    ) &&
    input.normalize('NFKC') === input &&
    !/[^0-9]/.test(input.replace(/[^\p{Nd}]/gu, ''))
  ) {
    return { text: input, changed: false };
  }
  const writer = projectionWriter(input.length);
  // eslint-disable-next-line no-control-regex -- Tokenize ANSI sequences with their original offsets.
  const units = /\x1b\[[0-?]*[ -/]*[@-~]|\\u[\da-fA-F]{4}|[\s\S]\p{M}*/gu;
  let changed = false;
  for (const match of input.matchAll(units)) {
    const raw = match[0];
    let value = raw;
    if (
      raw.startsWith('\x1b[') ||
      /^[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]$/u.test(raw)
    ) {
      changed = true;
      continue;
    }
    if (/^\\u[\da-fA-F]{4}$/.test(raw)) {
      value = String.fromCharCode(parseInt(raw.slice(2), 16));
    }
    if (/^[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]$/u.test(value)) {
      changed = true;
      continue;
    }
    value = asciiDigits(value.normalize('NFKC'));
    changed ||= value !== raw;
    writer.append(value, match.index, match.index + raw.length);
  }
  return { ...writer.finish(), changed };
}

export function codePointRange(text, start, end) {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start
  ) {
    throw new Error('Invalid code point range.');
  }
  const offsets = [0];
  let offset = 0;
  for (const char of text) {
    offset += char.length;
    offsets.push(offset);
  }
  if (end >= offsets.length) {
    throw new Error('Invalid code point range.');
  }
  return { start: offsets[start], end: offsets[end] };
}

function projectionWriter(inputLength) {
  const maxLength = 10 * 1024 * 1024;
  let capacity = Math.min(Math.max(inputLength, 16), maxLength);
  let starts = new Uint32Array(capacity),
    ends = new Uint32Array(capacity);
  const parts = [];
  let length = 0,
    chunk = '';
  return {
    append(value, start, end) {
      if (length + value.length > maxLength) {
        throw failure('ERR_LIMIT');
      }
      if (length + value.length > capacity) {
        capacity = Math.min(
          Math.max(capacity * 2, length + value.length),
          maxLength
        );
        const nextStarts = new Uint32Array(capacity),
          nextEnds = new Uint32Array(capacity);
        nextStarts.set(starts);
        nextEnds.set(ends);
        starts = nextStarts;
        ends = nextEnds;
      }
      chunk += value;
      if (chunk.length >= 8192) {
        parts.push(chunk);
        chunk = '';
      }
      for (let j = 0; j < value.length; j++) {
        starts[length] = start;
        ends[length++] = end;
      }
    },
    finish() {
      parts.push(chunk);
      return { text: parts.join(''), starts, ends };
    },
  };
}
