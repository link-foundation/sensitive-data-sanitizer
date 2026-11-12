// Map a detection view back to the original UTF-16 offsets. Normalization
// never writes to the original text, and offsets remain valid after emoji.
import { failure } from './detection.js';
import { htmlTag, inlineTags } from './html-tags.js';

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
const inlineTag = new RegExp(String.raw`^<\/?(?:${inlineTags})[\s/>]`);
// TruffleHog-style escape runs: `U+0074 U+006F ...` and CSS `\74 \6f ...`.
// Runs need four or more units so prose such as "U+200B" stays untouched.
// The space after the last unit stays in the view as a word boundary.
// Runs are matched unit by unit: `(?:U\+[\da-fA-F]{4,6} ?){3,}…` pushed a
// backtracking entry per unit, so a long run overflowed V8's
// regular-expression stack and failed sanitization closed (issue 170).
const codeUnit = /U\+[\da-fA-F]{4,6}( ?)/y;
// CSS units are separated by one space; a unit without one ends the run.
const cssUnit = /\\[\da-fA-F]{1,6}( ?)/y;
const projectionTrigger = new RegExp(
  String.raw`\x1b\[|\0|\\u[\da-fA-F{]|\\x\{[\da-fA-F]|\\U[\da-fA-F]{8}|%u[\da-fA-F]{4}|U\+[\da-fA-F]{4}|\\[\da-fA-F]{1,6} \\|[\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]|${htmlTag}`,
  'u'
);
const projectionUnits = new RegExp(
  String.raw`\x1b\[[0-?]*[ -/]*[@-~]|\\u[\da-fA-F]{4}|\\[ux]\{[\da-fA-F]{1,6}\}|\\U[\da-fA-F]{8}|%u[\da-fA-F]{4}|${htmlTag}|[\s\S]\p{M}*`,
  'guy'
);
// ASCII characters that cannot start an escape, ANSI sequence, HTML tag or
// invisible unit. Each one is its own unit and projects to itself, so a run
// of them is copied in bulk without matching and normalizing each
// character. `\0`, ESC, `%`, `<`, `U` and `\` still go through the units.
// The `hive-mask` ellipsis (`ghp…b4N`) also stays as itself: NFKC would turn
// it into `...`, which no token alphabet needs, and a changed view costs a
// second scan of the original text, so re-sanitizing a sanitized log would
// pay for every mask it already holds (#168). Masks match in both forms.
const plainRun =
  // eslint-disable-next-line no-control-regex -- ASCII control characters are plain units.
  /[\x01-\x1a\x1c-\x24\x26-\x3b\x3d-\x54\x56-\x5b\x5d-\x7f\u2026]+/y;
// A combining mark joins the character before it into one unit.
const leadingMark = /\p{M}/uy;

// The end of the escape run of four or more units at `index`, or -1.
function escapeRunEnd(input, index) {
  const code = input[index] === 'U';
  const unit = code ? codeUnit : cssUnit;
  unit.lastIndex = index;
  let units = 0;
  let end = -1;
  let match;
  while ((match = unit.exec(input))) {
    units++;
    end = unit.lastIndex - match[1].length;
    if (!code && !match[1]) {
      break;
    }
  }
  return units >= 4 ? end : -1;
}

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

// Every character decoded from an escape run maps to the whole run. Redacting
// only some units would leave a short run, such as a lone closing quote, that
// the next view no longer decodes, so a finding inside a run covers all of it.
function appendRun(writer, raw, offset) {
  const unit = raw.startsWith('U+')
    ? /U\+([\da-fA-F]{4,6}) ?/g
    : /\\([\da-fA-F]{1,6}) ?/g;
  const end = offset + raw.length;
  for (const match of raw.matchAll(unit)) {
    const code = parseInt(match[1], 16);
    const value = code <= 0x10ffff ? String.fromCodePoint(code) : match[0];
    if (!invisible.test(value)) {
      writer.append(value, offset, end);
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
  let index = 0;
  while (index < input.length) {
    plainRun.lastIndex = index;
    if (plainRun.test(input)) {
      let end = plainRun.lastIndex;
      leadingMark.lastIndex = end;
      if (leadingMark.test(input)) {
        end--;
      }
      if (end > index) {
        writer.copy(input, index, end);
        index = end;
        continue;
      }
    }
    const runEnd =
      input[index] === 'U' || input[index] === '\\'
        ? escapeRunEnd(input, index)
        : -1;
    let raw;
    if (runEnd > index) {
      raw = input.slice(index, runEnd);
    } else {
      projectionUnits.lastIndex = index;
      raw = projectionUnits.exec(input)[0];
    }
    changed = projectUnit(writer, raw, index) || changed;
    index += raw.length;
  }
  return changed
    ? { ...writer.finish(), changed }
    : { text: input, changed: false };
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
  function reserve(size) {
    if (length + size > maxLength) {
      throw failure('ERR_LIMIT');
    }
    if (length + size > capacity) {
      capacity = Math.min(Math.max(capacity * 2, length + size), maxLength);
      const nextStarts = new Uint32Array(capacity),
        nextEnds = new Uint32Array(capacity);
      nextStarts.set(starts);
      nextEnds.set(ends);
      starts = nextStarts;
      ends = nextEnds;
    }
  }
  function write(value) {
    chunk += value;
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = '';
    }
  }
  return {
    append(value, start, end) {
      reserve(value.length);
      write(value);
      for (let j = 0; j < value.length; j++) {
        starts[length] = start;
        ends[length++] = end;
      }
    },
    // Characters that project to themselves keep their own offsets.
    copy(input, start, end) {
      reserve(end - start);
      write(input.slice(start, end));
      for (let j = start; j < end; j++) {
        starts[length] = j;
        ends[length++] = j + 1;
      }
    },
    finish() {
      parts.push(chunk);
      return { text: parts.join(''), starts, ends };
    },
  };
}
