// A listed name can hide behind an encoding or a decoration: URL
// percent-encoding (`%D0%9F…`, `+` between words), HTML character references
// (`&#1055;`, `&#x41f;`, `&nbsp;`, `&shy;`), a literal `\n` or `\t` escape, a
// combining stress mark (`Велими́ра`) or a look-alike letter of another script
// inside a word (`Пряжкинa` with a Latin `a`). The view decodes them for the
// known-value matcher only, and maps each decoded character back to the
// original characters it came from, so a finding covers the encoded text.
// Credential and pattern detectors keep their own views.
import { projectionWriter } from './projection.js';

const cyrillicNames = [
  'A',
  'B',
  'V',
  'G',
  'D',
  'IE',
  'ZH',
  'Z',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'R',
  'S',
  'T',
  'U',
  'F',
  'KH',
  'TS',
  'CH',
  'SH',
  'SHCH',
  'HARD',
  'Y',
  'SOFT',
  'E',
  'YU',
  'YA',
];
// Named references that can stand inside or between the words of a name: the
// HTML spaces, invisible characters, quotes and dashes, and the Cyrillic
// letters (`&Pcy;&rcy;…`).
const entities = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', ' '],
  ['NonBreakingSpace', ' '],
  ['ensp', ' '],
  ['emsp', ' '],
  ['emsp13', ' '],
  ['emsp14', ' '],
  ['numsp', ' '],
  ['puncsp', ' '],
  ['thinsp', ' '],
  ['ThinSpace', ' '],
  ['hairsp', ' '],
  ['VeryThinSpace', ' '],
  ['MediumSpace', ' '],
  ['NewLine', '\n'],
  ['Tab', '\t'],
  ['shy', ''],
  ['zwsp', ''],
  ['ZeroWidthSpace', ''],
  ['NegativeVeryThinSpace', ''],
  ['NegativeThinSpace', ''],
  ['NegativeMediumSpace', ''],
  ['NegativeThickSpace', ''],
  ['zwj', ''],
  ['zwnj', ''],
  ['lrm', ''],
  ['rlm', ''],
  ['NoBreak', ''],
  ['InvisibleTimes', ''],
  ['InvisibleComma', ''],
  ['ic', ''],
  ['it', ''],
  ['af', ''],
  ['ApplyFunction', ''],
  ['laquo', '«'],
  ['raquo', '»'],
  ['ldquo', '“'],
  ['rdquo', '”'],
  ['bdquo', '„'],
  ['lsquo', '‘'],
  ['rsquo', '’'],
  ['sbquo', '‚'],
  ['ndash', '–'],
  ['mdash', '—'],
  ['hyphen', '‐'],
  ['dash', '‐'],
  ['acute', ''],
  ['grave', ''],
  ...cyrillicNames.flatMap((name, index) => [
    [`${name}cy`, String.fromCodePoint(0x410 + index)],
    [`${name.toLowerCase()}cy`, String.fromCodePoint(0x430 + index)],
  ]),
  ['IOcy', 'Ё'],
  ['iocy', 'ё'],
]);
// Format characters that never belong to a name (also removed by the general
// projection, which this view may not run behind).
const invisible =
  /^(?:\u034f|[\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff])$/u;
// Stress and other accents a Cyrillic word can carry: acute, grave,
// double acute, double grave, inverted breve and macron.
const stressMarks = /[\u0300\u0301\u0302\u0304\u030b\u030f\u0311]/gu;
const trigger =
  /%[\da-fA-F]{2}|&(?:#\d{1,7}|#[xX][\da-fA-F]{1,6}|[A-Za-z][A-Za-z\d]{1,31});|\\[ntr\\]|[\u0300-\u036f\u00ad\u200b-\u200f\u2060-\u206f\ufeff]|\p{L}\+[\p{L}%]/u;
const units =
  /(?:%[\da-fA-F]{2})+|&(?:#\d{1,7}|#[xX][\da-fA-F]{1,6}|[A-Za-z][A-Za-z\d]{1,31});|\\[ntr\\]|[\s\S]/uy;
const plainRun =
  /[^%&\\+\p{M}\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]+/uy;
const letterBefore = /(?:\p{L}|%[\da-fA-F]{2})$/u;
const letterAfter = /\p{L}|%[\da-fA-F]{2}/uy;
const escapes = { n: '\n', t: '\t', r: '\r', '\\': '\\' };

function percentDecode(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}

// The number of UTF-8 bytes a character takes, from its code point or from
// the lead byte that starts it (0 for a byte that cannot start one).
const utf8Size = (code) =>
  code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
const leadSize = (byte) =>
  byte < 0x80
    ? 1
    : byte < 0xc2
      ? 0
      : byte < 0xe0
        ? 2
        : byte < 0xf0
          ? 3
          : byte < 0xf5
            ? 4
            : 0;

// Each UTF-8 character of a percent run maps to the escapes that encode it.
// Bytes that are not UTF-8 stay as they are; a valid run decodes at once.
function appendPercent(writer, raw, offset) {
  const whole = percentDecode(raw);
  if (whole !== undefined) {
    let start = offset;
    for (const char of whole) {
      const end = start + 3 * utf8Size(char.codePointAt(0));
      writer.append(char, start, end);
      start = end;
    }
    return;
  }
  let index = 0;
  while (index < raw.length) {
    const size = leadSize(parseInt(raw.slice(index + 1, index + 3), 16));
    const char = size
      ? percentDecode(raw.slice(index, index + size * 3))
      : undefined;
    const end = char ? index + size * 3 : index + 3;
    writer.append(char ?? raw.slice(index, end), offset + index, offset + end);
    index = end;
  }
}

function decodeReference(raw) {
  if (raw[1] === '#') {
    const code =
      raw[2] === 'x' || raw[2] === 'X'
        ? parseInt(raw.slice(3, -1), 16)
        : Number(raw.slice(2, -1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code)
      : undefined;
  }
  return entities.get(raw.slice(1, -1));
}

// A `+` is a URL-encoded space only between two letters of a query value.
function plusIsSpace(text, index) {
  letterAfter.lastIndex = index + 1;
  return (
    letterBefore.test(text.slice(Math.max(0, index - 3), index)) &&
    letterAfter.test(text)
  );
}

function decodeUnit(writer, text, raw, index, decoding) {
  const end = index + raw.length;
  if (raw[0] === '%' && raw.length > 1) {
    appendPercent(writer, raw, index);
    return;
  }
  const value =
    raw[0] === '&' && raw.length > 1
      ? decodeReference(raw)
      : raw[0] === '\\' && raw.length === 2
        ? escapes[raw[1]]
        : raw === '+' && decoding && plusIsSpace(text, index)
          ? ' '
          : undefined;
  if (value === undefined) {
    if (!invisible.test(raw)) {
      writer.copy(text, index, end);
    }
  } else if (value && !invisible.test(value)) {
    writer.append(value, index, end);
  }
}

// With `decoding` off (the `decode: false` option) only invisible characters
// go: encodings stay as they are.
function decode(text, decoding) {
  const writer = projectionWriter(text.length);
  let index = 0;
  while (index < text.length) {
    plainRun.lastIndex = index;
    if (plainRun.test(text)) {
      writer.copy(text, index, plainRun.lastIndex);
      index = plainRun.lastIndex;
      continue;
    }
    units.lastIndex = index;
    const raw = decoding ? units.exec(text)[0] : text[index];
    decodeUnit(writer, text, raw, index, decoding);
    index += raw.length;
  }
  return writer.finish();
}

const latinToCyrillic = new Map(
  [...'aceopxyABCEHKMOPTX'].map((latin, i) => [latin, 'асеорхуАВСЕНКМОРТХ'[i]])
);
const cyrillicToLatin = new Map(
  [...latinToCyrillic].map(([latin, cyrillic]) => [cyrillic, latin])
);
const cyrillicLetter = /\p{Script=Cyrillic}/u;

// The look-alike map that turns a mixed-script word into the script of most
// of its letters, or undefined for a single-script word or a tie.
function wordSwap(word) {
  const cyrillic = (word.match(/\p{Script=Cyrillic}/gu) ?? []).length;
  const latin = (word.match(/\p{Script=Latin}/gu) ?? []).length;
  if (!cyrillic || !latin || cyrillic === latin) {
    return undefined;
  }
  return cyrillic > latin ? latinToCyrillic : cyrillicToLatin;
}

// Stress marks on a Cyrillic letter go, and `и`/`е` with a breve or diaeresis
// compose to `й`/`ё`.
function normalizeUnit(unit, swap) {
  let value = unit;
  if (cyrillicLetter.test(unit[0]) && unit.length > 1) {
    value = unit.normalize('NFD').replace(stressMarks, '').normalize('NFC');
  } else if (/^\p{M}/u.test(unit)) {
    value = unit.replace(stressMarks, '');
  }
  return swap?.get(value) ?? value;
}

// A word can only change when the text has a combining mark or a Cyrillic
// letter next to a Latin one.
const wordChange =
  /\p{M}|\p{Script=Cyrillic}[A-Za-z]|[A-Za-z]\p{Script=Cyrillic}/u;

function normalizeWords(view) {
  const { text, starts, ends } = view;
  if (!wordChange.test(text)) {
    return view;
  }
  const changed = [...text.matchAll(/[\p{L}\p{M}]+/gu)].filter(
    ([word]) =>
      /\p{M}/u.test(word) ||
      (cyrillicLetter.test(word) && /[A-Za-z]/u.test(word) && wordSwap(word))
  );
  if (!changed.length) {
    return view;
  }
  const writer = projectionWriter(text.length);
  let index = 0;
  for (const { 0: word, index: start } of changed) {
    writer.carry(view, index, start);
    index = start + word.length;
    const swap = wordSwap(word);
    let offset = start;
    for (const unit of word.match(/\P{M}\p{M}*|\p{M}+/gu)) {
      const from = offset;
      offset += unit.length;
      for (const char of normalizeUnit(unit, swap)) {
        writer.append(char, starts[from], ends[offset - 1]);
      }
    }
  }
  writer.carry(view, index, text.length);
  return writer.finish();
}

// The decoded view of `text`, or undefined when nothing in it would change.
// `decoding: false` keeps percent-encoding, HTML references and escapes.
export function knownView(text, decoding = true) {
  const mixed = cyrillicLetter.test(text) && /[A-Za-z]/u.test(text);
  if (!mixed && !trigger.test(text)) {
    return undefined;
  }
  const decoded = decode(text, decoding);
  const view = normalizeWords(decoded);
  return view.text === text ? undefined : view;
}
