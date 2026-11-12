// Regular-expression loops that stay flat on two-byte strings (#172).
//
// With the `u` flag, V8 compiles a character class that can match an astral
// code point (`\p{L}`, `\S`, `[^…]`) as a non-simple loop whenever the subject
// is a two-byte string (one holding any character above U+00FF, such as an
// emoji, `—` or a `…` mask). Such a loop pushes one backtracking entry per
// character, so a 4 MiB letter run overflowed V8's regular-expression stack
// and `sanitize()` failed with ERR_SANITIZATION. A class of BMP code points
// only stays a simple loop on any string.
//
// `unicodeRun('[\\p{L}\\p{N}]', '+')` spells `[\p{L}\p{N}]+` as
// `[\p{L}\p{N}]B*(?:AB*){0,256}`, where B lists the BMP members of the class as
// ranges and A is one astral member. B and A are disjoint, so the loop is
// unambiguous and matches the same text as the original wherever at most 256
// astral characters stand in one run. Experiments:
// experiments/issue-172/bmp-class.mjs and experiments/issue-172/find-regex.mjs.

const ASTRAL_LIMIT = 256;
let planes;
const cache = new Map();

function bmpText() {
  planes ??= [
    { text: codeUnits(0, 0xd7ff), base: 0 },
    { text: codeUnits(0xe000, 0xffff), base: 0xe000 },
  ];
  return planes;
}

function codeUnits(from, to) {
  const units = [];
  for (let c = from; c <= to; c++) {
    units.push(String.fromCharCode(c));
  }
  return units.join('');
}

// Literal characters keep the source short: V8 stops optimizing an
// expression whose source exceeds 20 KB. Only class syntax and line breaks
// are escaped.
const literal = (c) =>
  /[\\\][^-]/.test(String.fromCharCode(c)) ||
  c < 0x20 ||
  c === 0x2028 ||
  c === 0x2029
    ? `\\u${c.toString(16).padStart(4, '0')}`
    : String.fromCharCode(c);

function split(cls, ignoreCase) {
  const key = `${ignoreCase ? 'i' : ''}${cls}`;
  let parts = cache.get(key);
  if (parts) {
    return parts;
  }
  const flags = ignoreCase ? 'giu' : 'gu';
  const ranges = [];
  for (const { text, base } of bmpText()) {
    for (const match of text.matchAll(new RegExp(`${cls}+`, flags))) {
      const start = base + match.index;
      const end = start + match[0].length - 1;
      ranges.push(
        start === end
          ? literal(start)
          : end === start + 1
            ? `${literal(start)}${literal(end)}`
            : `${literal(start)}-${literal(end)}`
      );
    }
  }
  // A class reaches past the BMP through a property, a negation, a shorthand
  // such as `\S`, `.`, a `\u{…}` escape or a literal astral character.
  const hasAstral =
    /\\[pPSWD]|\[\^|\\u\{/.test(cls) ||
    cls === '.' ||
    /[\u{10000}-\u{10ffff}]/u.test(cls);
  parts = {
    bmp: ranges.length ? `[${ranges.join('')}]` : '[]',
    astral: hasAstral ? `(?:(?![\\0-\\uffff])${cls})` : '',
  };
  cache.set(key, parts);
  return parts;
}

/**
 * The pattern source for `cls` repeated by `quantifier` (`+`, `*`, `+?` or
 * `*?`), safe to embed in a `u`-flag expression. Set `ignoreCase` when the
 * enclosing expression has the `i` flag.
 */
export function unicodeRun(cls, quantifier = '+', ignoreCase = false) {
  const { bmp, astral } = split(cls, ignoreCase);
  const lazy = quantifier.endsWith('?') ? '?' : '';
  const atLeastOne = quantifier.startsWith('+');
  if (!astral) {
    return `${bmp}${quantifier}`;
  }
  const rest = `${bmp}*${lazy}(?:${astral}${bmp}*${lazy}){0,${ASTRAL_LIMIT}}${lazy}`;
  // The first character takes the original class: one step, no loop.
  return atLeastOne ? `${cls}${rest}` : rest;
}

// One atom of a pattern source at `i`: a class, `\p{…}`, an escape or a
// character. `loop` marks atoms `unicodeRun` can spell.
function atom(source, i) {
  if (source[i] === '[') {
    let j = i + 1;
    while (source[j] !== ']') {
      j += source[j] === '\\' ? 2 : 1;
    }
    return { text: source.slice(i, j + 1), loop: true };
  }
  if (source[i] === '\\') {
    if (/[pP]\{/.test(source.slice(i + 1, i + 3))) {
      const end = source.indexOf('}', i);
      return { text: source.slice(i, end + 1), loop: true };
    }
    return { text: source.slice(i, i + 2), loop: /[SWD]/.test(source[i + 1]) };
  }
  return { text: source[i], loop: false };
}

/**
 * `regex` with every unbounded loop over a class (`[…]+`, `\p{L}*?`,
 * `\S{2,}`) spelled by `unicodeRun`, so a long run in a two-byte string
 * cannot overflow V8's backtracking stack (#172). Loops inside lookbehinds
 * match right to left and stay as written; keep those bounded.
 */
export function flatRegExp(regex) {
  const { source, flags } = regex;
  if (!flags.includes('u')) {
    return regex;
  }
  const ignoreCase = flags.includes('i');
  let out = '';
  const groups = [];
  for (let i = 0; i < source.length;) {
    if (source[i] === '(') {
      groups.push(/^\(\?<[=!]/.test(source.slice(i, i + 4)));
    } else if (source[i] === ')') {
      groups.pop();
    }
    const { text, loop } = atom(source, i);
    i += text.length;
    const quantifier = /^(?:[+*]|\{(\d+),\})\??/.exec(source.slice(i));
    if (!loop || !quantifier || groups.includes(true)) {
      out += text;
      continue;
    }
    i += quantifier[0].length;
    const lazy = quantifier[0].endsWith('?') ? '?' : '';
    const min = quantifier[1];
    out += min
      ? `${text}{${min}}${lazy}${unicodeRun(text, `*${lazy}`, ignoreCase)}`
      : unicodeRun(text, quantifier[0], ignoreCase);
  }
  return new RegExp(out, flags);
}
