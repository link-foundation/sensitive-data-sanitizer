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

// Invisible format characters and NUL (UTF-16 text read as bytes) never
// carry meaning inside a token, so they are removed from the detection view.
const invisible =
  /^[\0\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]$/u;
// HTML formatting tags split tokens (`SECRET_</span><span>REST`). Inline tags
// are dropped and block tags become line breaks. Only presentation attributes
// are allowed, so other attribute values (URLs, data-*) stay in the view.
const inlineTags =
  'abbr|b|cite|code|del|em|font|i|ins|kbd|mark|q|s|samp|small|span|strong|sub|sup|tt|u|var';
const blockTags =
  'blockquote|br|dd|div|dt|h[1-6]|hr|li|ol|p|pre|table|tbody|td|th|thead|tr|ul';
const htmlTag = String.raw`<\/?(?:${inlineTags}|${blockTags})(?:\s+(?:class|dir|lang|style)="[^"<>=]*")*\s*\/?>`;
const inlineTag = new RegExp(String.raw`^<\/?(?:${inlineTags})[\s/>]`);
// TruffleHog-style escape runs: `U+0074 U+006F ...` and CSS `\74 \6f ...`.
// Runs need four or more units so prose such as "U+200B" stays untouched.
const codeRun = String.raw`(?:U\+[\da-fA-F]{4,6} ?){4,}`;
const cssRun = String.raw`(?:\\[\da-fA-F]{1,6} ){3,}\\[\da-fA-F]{1,6} ?`;
const projectionTrigger = new RegExp(
  String.raw`\x1b\[|\0|\\u[\da-fA-F{]|\\x\{[\da-fA-F]|\\U[\da-fA-F]{8}|%u[\da-fA-F]{4}|U\+[\da-fA-F]{4}|\\[\da-fA-F]{1,6} \\|[\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]|${htmlTag}`,
  'u'
);
const projectionUnits = new RegExp(
  String.raw`\x1b\[[0-?]*[ -/]*[@-~]|\\u[\da-fA-F]{4}|\\[ux]\{[\da-fA-F]{1,6}\}|\\U[\da-fA-F]{8}|%u[\da-fA-F]{4}|${codeRun}|${cssRun}|${htmlTag}|[\s\S]\p{M}*`,
  'gu'
);

function decodeEscape(raw) {
  const escape = /^(?:\\[ux]\{?|\\U|%u)([\da-fA-F]+)\}?$/.exec(raw);
  if (!escape) {
    return raw;
  }
  const code = parseInt(escape[1], 16);
  // `\uXXXX` keeps UTF-16 surrogate halves; wider forms are code points.
  return raw.length === 6 && raw[0] === '\\'
    ? String.fromCharCode(code)
    : code <= 0x10ffff
      ? String.fromCodePoint(code)
      : raw;
}

// Decode each unit of an escape run with its own original span.
function appendRun(writer, raw, offset) {
  const unit = raw.startsWith('U+')
    ? /U\+([\da-fA-F]{4,6}) ?/g
    : /\\([\da-fA-F]{1,6}) ?/g;
  for (const match of raw.matchAll(unit)) {
    const code = parseInt(match[1], 16);
    const value = code <= 0x10ffff ? String.fromCodePoint(code) : match[0];
    const start = offset + match.index;
    if (!invisible.test(value)) {
      writer.append(value, start, start + match[0].length);
    }
  }
}

function projectUnit(writer, raw, offset) {
  const end = offset + raw.length;
  if (raw.startsWith('\x1b[') || invisible.test(raw)) {
    return true;
  }
  if (raw[0] === '<' && raw.length > 2 && raw.endsWith('>')) {
    if (!inlineTag.test(raw)) {
      writer.append('\n', offset, end);
    }
    return true;
  }
  if (raw.length > 8 && /^(?:U\+|\\[\da-fA-F])/.test(raw)) {
    appendRun(writer, raw, offset);
    return true;
  }
  const decoded = decodeEscape(raw);
  if (invisible.test(decoded)) {
    return true;
  }
  const value = asciiDigits(decoded.normalize('NFKC'));
  writer.append(value, offset, end);
  return value !== raw;
}

export function projectText(input) {
  if (
    !projectionTrigger.test(input) &&
    // ASCII already has normalized letters and digits. Avoid constructing a
    // second multi-megabyte string just to check its decimal characters.
    // eslint-disable-next-line no-control-regex -- Check the ASCII range.
    (!/[^\x00-\x7f]/.test(input) ||
      (input.normalize('NFKC') === input &&
        !/[^0-9]/.test(input.replace(/[^\p{Nd}]/gu, ''))))
  ) {
    return { text: input, changed: false };
  }
  const writer = projectionWriter(input.length);
  let changed = false;
  for (const match of input.matchAll(projectionUnits)) {
    changed = projectUnit(writer, match[0], match.index) || changed;
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
  // Input length has already been checked by the caller. Unicode NFKC can
  // expand a single scalar to at most 18 scalars; retain a finite bound.
  const maxLength = Math.max(inputLength * 18, 16);
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
