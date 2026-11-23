// Literal prefilter for known personal values.
//
// Every known entry is one regular expression, and V8 compiles an expression
// on its first `exec` and again when it tiers it up. With thousands of entries
// the first calls of a process spend most of their time compiling expressions
// whose values do not occur in the text. The matcher reads the literal text an
// entry's matches must start with (its anchors), folds both anchors and the
// text the way the `iu` flags compare characters, and runs an expression only
// when one of its anchors occurs at a word start of the text.

import { escapePattern } from './escape-pattern.js';

// Characters whose case-insensitive equivalents all lower-case to one
// character of this set, apart from the listed exceptions. The set and the
// exceptions are checked against every code point in the tests: printable
// ASCII, Latin-1 and Latin Extended-A/B letters, modifier quotes and basic
// Cyrillic. `µ` and `İ` stay out: the first equals Greek mu, the second has a
// two-character lower case.
const anchorRanges = [
  [0x21, 0x7e],
  [0xa1, 0x24f],
  [0x2b9, 0x2ba],
  [0x400, 0x45f],
  [0x2019, 0x2019],
];
const unsafeAnchors = new Set([0xb5, 0x130]);
const foldExceptions = new Map([
  ['ё', 'е'],
  ['ſ', 's'],
  ['ᲀ', 'в'],
  ['ᲁ', 'д'],
  ['ᲂ', 'о'],
  ['ᲃ', 'с'],
  ['ᲄ', 'т'],
  ['ᲅ', 'т'],
  ['ᲆ', 'ъ'],
]);
const exceptionPattern = new RegExp(
  `[${[...foldExceptions.keys()].join('')}]`,
  'gu'
);
const anchorLength = 4;
const anchorLimit = 512;

export function isAnchorCharacter(char) {
  const code = char.codePointAt(0);
  return (
    char.length === 1 &&
    !unsafeAnchors.has(code) &&
    anchorRanges.some(([from, to]) => code >= from && code <= to)
  );
}

/**
 * Folds text for anchor lookups. The result has the same UTF-16 indexes as
 * the text: a character whose lower case has another length becomes `\0`
 * sentinels, which no anchor contains.
 */
export function foldText(text) {
  let lower = text.toLowerCase();
  if (lower.length !== text.length) {
    lower = '';
    for (const char of text) {
      const folded = char.toLowerCase();
      lower +=
        folded.length === char.length ? folded : '\0'.repeat(char.length);
    }
  }
  return lower.replace(exceptionPattern, (char) => foldExceptions.get(char));
}

const foldedCharacters = new Map();
// The folded form of one literal pattern character, or undefined when the
// character cannot be an anchor: its case-insensitive equivalents might fold
// to something else.
function foldCharacter(char) {
  if (!foldedCharacters.has(char)) {
    const folded = foldText(char);
    const escaped = escapePattern(char);
    foldedCharacters.set(
      char,
      isAnchorCharacter(folded) &&
        new RegExp(`^${escaped}$`, 'iu').test(char.toLowerCase())
        ? folded
        : undefined
    );
  }
  return foldedCharacters.get(char);
}

// A prefix is the folded literal text matches start with; `open` prefixes
// may still grow with the next pattern element.
const closed = (prefixes) =>
  prefixes.map(({ text }) => ({ text, open: false }));
const empty = [{ text: '', open: true }];
const stop = [{ text: '', open: false }];

class TooMany extends Error {}

function concat(left, right) {
  const out = new Map();
  for (const prefix of left) {
    const tails = prefix.open ? right : [{ text: '', open: false }];
    for (const tail of tails) {
      const joined = prefix.text + tail.text;
      const text = joined.slice(0, anchorLength);
      const open = prefix.open && tail.open && joined.length < anchorLength;
      const key = `${open ? 1 : 0}${text}`;
      out.set(key, { text, open });
    }
  }
  if (out.size > anchorLimit) {
    throw new TooMany();
  }
  return [...out.values()];
}

const escapeChars = { t: '\t', n: '\n', r: '\r', f: '\f', v: '\v', 0: '\0' };

// Parses one escape at `pos` (after the backslash); returns the literal
// character it stands for, or undefined for classes and assertions.
function readEscape(source, pos) {
  const head = source[pos];
  let match;
  if ((match = /^u\{([\da-fA-F]+)\}/u.exec(source.slice(pos, pos + 10)))) {
    return {
      char: String.fromCodePoint(parseInt(match[1], 16)),
      end: pos + match[0].length,
    };
  }
  if (
    (match = /^(?:u([\da-fA-F]{4})|x([\da-fA-F]{2}))/u.exec(
      source.slice(pos, pos + 5)
    ))
  ) {
    return {
      char: String.fromCharCode(parseInt(match[1] ?? match[2], 16)),
      end: pos + match[0].length,
    };
  }
  if ((head === 'p' || head === 'P') && source[pos + 1] === '{') {
    return { char: undefined, end: source.indexOf('}', pos) + 1 };
  }
  if (head === 'k' && source[pos + 1] === '<') {
    return { char: undefined, end: source.indexOf('>', pos) + 1 };
  }
  if (escapeChars[head] !== undefined) {
    return { char: escapeChars[head], end: pos + 1 };
  }
  if (/[\p{L}\p{N}]/u.test(head)) {
    // \d, \w, \s, \b, \B, \c and back references.
    return { char: undefined, end: pos + 1 };
  }
  const char = String.fromCodePoint(source.codePointAt(pos));
  return { char, end: pos + char.length };
}

// A class adds its character only when every member folds to the same one,
// as `[её]`, `[sS]` or `[tT]` do.
function readClass(source, pos) {
  let index = pos + 1;
  const negated = source[index] === '^';
  const folds = new Set();
  let known = !negated;
  index += negated ? 1 : 0;
  while (index < source.length && source[index] !== ']') {
    let char;
    if (source[index] === '\\') {
      ({ char, end: index } = readEscape(source, index + 1));
    } else {
      char = String.fromCodePoint(source.codePointAt(index));
      index += char.length;
    }
    if (source[index] === '-' && source[index + 1] !== ']') {
      known = false;
    }
    folds.add(char === undefined ? undefined : foldCharacter(char));
  }
  const [only] = folds;
  const prefixes =
    known && folds.size === 1 && only !== undefined
      ? [{ text: only, open: true }]
      : stop;
  return { prefixes, end: index + 1 };
}

function readGroup(source, pos) {
  const rest = source.slice(pos, pos + 4);
  const lookaround = /^\(\?(?:<?[=!])/u.exec(rest);
  const named = /^\(\?<[\p{L}\p{N}_$]+>/u.exec(source.slice(pos, pos + 70));
  const start =
    pos +
    (lookaround?.[0].length ??
      named?.[0].length ??
      (rest.startsWith('(?:') ? 3 : 1));
  const inner = readAlternation(source, start);
  return { prefixes: lookaround ? empty : inner.prefixes, end: inner.end + 1 };
}

function readAtom(source, pos) {
  const head = source[pos];
  if (head === '(') {
    return readGroup(source, pos);
  }
  if (head === '[') {
    return readClass(source, pos);
  }
  if (head === '^' || head === '$') {
    return { prefixes: empty, end: pos + 1 };
  }
  if (head === '.') {
    return { prefixes: stop, end: pos + 1 };
  }
  const { char, end } =
    head === '\\'
      ? readEscape(source, pos + 1)
      : {
          char: String.fromCodePoint(source.codePointAt(pos)),
          end: pos + 1 + (source.codePointAt(pos) > 0xffff ? 1 : 0),
        };
  const folded = char === undefined ? undefined : foldCharacter(char);
  return {
    prefixes: folded === undefined ? stop : [{ text: folded, open: true }],
    end,
  };
}

// Applies a quantifier: an optional atom may be absent, and after a repeated
// atom the next character is unknown.
function quantify(source, atom) {
  const quantifier = /^(?:[?*+]|\{(\d+)(,\d*)?\})\??/u.exec(
    source.slice(atom.end, atom.end + 24)
  );
  if (!quantifier) {
    return atom;
  }
  const [text, min, range] = quantifier;
  const end = atom.end + text.length;
  const head = text[0];
  if (head === '?') {
    return { prefixes: [...atom.prefixes, ...empty], end };
  }
  const repeated = closed(atom.prefixes);
  if (head === '*' || (head === '{' && Number(min) === 0)) {
    return { prefixes: [...repeated, ...empty], end };
  }
  if (head === '{' && range === undefined && Number(min) === 1) {
    return { prefixes: atom.prefixes, end };
  }
  return { prefixes: repeated, end };
}

function readSequence(source, pos) {
  let prefixes = empty;
  let index = pos;
  while (
    index < source.length &&
    source[index] !== '|' &&
    source[index] !== ')'
  ) {
    const atom = quantify(source, readAtom(source, index));
    if (prefixes.some((prefix) => prefix.open)) {
      prefixes = concat(prefixes, atom.prefixes);
    }
    index = atom.end;
  }
  return { prefixes, end: index };
}

function readAlternation(source, pos) {
  const prefixes = [];
  let index = pos;
  for (;;) {
    const sequence = readSequence(source, index);
    prefixes.push(...sequence.prefixes);
    if (prefixes.length > anchorLimit) {
      throw new TooMany();
    }
    index = sequence.end;
    if (source[index] !== '|') {
      return { prefixes, end: index };
    }
    index++;
  }
}

/**
 * Returns the folded literal prefixes (up to four characters) that every
 * match of `source` starts with, or `undefined` when some match may start
 * with a character that is no anchor, such as a class or a space.
 */
export function regexAnchors(source) {
  try {
    const { prefixes } = readAlternation(source, 0);
    const anchors = new Set(prefixes.map(({ text }) => text));
    return anchors.has('') ? undefined : [...anchors];
  } catch (error) {
    if (error instanceof TooMany) {
      return undefined;
    }
    throw error;
  }
}

function eachGlobal(text, pattern, visit) {
  pattern.lastIndex = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match[0] === '') {
      pattern.lastIndex = match.index + 1;
    }
    visit(match);
  }
}

// Positions where a known value may start: after a non-letter, or at a case
// change inside an identifier such as `tyutyunnikCase` or `HTTPServer`. This
// is the expression `isStart` evaluates at one position; the tests compare
// the two on every character class it distinguishes.
export const startPattern =
  /(?<!\p{L})\S|(?<=\p{Ll})\p{Lu}|(?<=\p{Lu})\p{Lu}(?=\p{Ll})/gu;

// Character classes of the start expression, computed once per code point:
// bit 1 marks a computed entry, then letter, upper case, lower case, space.
const computed = 1,
  letter = 2,
  upper = 4,
  lower = 8,
  space = 16;
const bmpClasses = new Uint8Array(0x10000);
const astralClasses = new Map();
function classify(code) {
  const char = String.fromCodePoint(code);
  return (
    computed |
    (/\p{L}/u.test(char) ? letter : 0) |
    (/\p{Lu}/u.test(char) ? upper : 0) |
    (/\p{Ll}/u.test(char) ? lower : 0) |
    (/\s/u.test(char) ? space : 0)
  );
}
function classOf(code) {
  if (code < 0) {
    return computed;
  }
  if (code < 0x10000) {
    return (bmpClasses[code] ||= classify(code));
  }
  if (!astralClasses.has(code)) {
    astralClasses.set(code, classify(code));
  }
  return astralClasses.get(code);
}
// The code point that ends before `index`, or -1 at the start of the text.
function codeBefore(text, index) {
  if (index <= 0) {
    return -1;
  }
  const low = text.charCodeAt(index - 1);
  if (low >= 0xdc00 && low <= 0xdfff && index > 1) {
    const high = text.charCodeAt(index - 2);
    if (high >= 0xd800 && high <= 0xdbff) {
      return ((high - 0xd800) << 10) + (low - 0xdc00) + 0x10000;
    }
  }
  return low;
}
const codeAt = (text, index) =>
  index < text.length ? text.codePointAt(index) : -1;

/**
 * Whether `startPattern` matches at `index`, for an index that does not
 * split a surrogate pair. Reading the classes of two or three code points
 * replaces a global expression scan that allocated a match object for every
 * word of the text.
 */
export function isStart(text, index) {
  const code = codeAt(text, index);
  const current = classOf(code);
  const before = classOf(codeBefore(text, index));
  if (!(before & letter)) {
    return !(current & space);
  }
  if (!(current & upper)) {
    return false;
  }
  return (
    Boolean(before & lower) ||
    (Boolean(before & upper) &&
      Boolean(classOf(codeAt(text, index + (code > 0xffff ? 2 : 1))) & lower))
  );
}

/**
 * Builds a matcher for `entries`. `sourceOf(entry)` returns the expression
 * source of an entry, `regexOf(entry, source, sticky)` compiles it. An entry
 * with anchors runs as a sticky expression at the positions where one of its
 * anchors occurs, so its cost follows those positions, not the text length.
 * An entry without anchors runs as a global expression over the whole text.
 * Expressions are created on first use and kept with the matcher.
 */
export function createMatcher(entries, sourceOf, regexOf) {
  const sources = [];
  const always = [];
  // Anchors as a trie of folded UTF-16 code units: a node lists the entries
  // whose anchor ends at it and the nodes of the next code unit.
  const root = new Map();
  for (const [index, entry] of entries.entries()) {
    const source = sourceOf(entry);
    sources.push(source);
    const anchors = regexAnchors(source);
    if (anchors === undefined) {
      always.push(index);
      continue;
    }
    for (const anchor of anchors) {
      let next = root,
        node;
      for (let i = 0; i < anchor.length; i++) {
        const code = anchor.charCodeAt(i);
        node = next.get(code);
        if (!node) {
          node = { next: new Map(), entries: [] };
          next.set(code, node);
        }
        next = node.next;
      }
      if (!node.entries.includes(index)) {
        node.entries.push(index);
      }
    }
  }
  const alwaysSet = new Set(always);
  const regexes = new Array(entries.length);
  const regex = (index) => {
    regexes[index] ??= regexOf(
      entries[index],
      sources[index],
      !alwaysSet.has(index)
    );
    return regexes[index];
  };
  // Start positions of each entry, ascending; `null` for a whole-text run.
  const positions = (text) => {
    const found = new Array(entries.length);
    for (const index of always) {
      found[index] = null;
    }
    if (root.size === 0) {
      return found;
    }
    // Only a character that starts an anchor can start a match, so the
    // start test runs at those characters, and the trie is walked by code
    // unit without slicing the text.
    const folded = foldText(text);
    for (let start = 0; start < folded.length; start++) {
      let node = root.get(folded.charCodeAt(start));
      if (node === undefined || !isStart(text, start)) {
        continue;
      }
      for (let i = start + 1; node !== undefined; i++) {
        for (const index of node.entries) {
          const list = (found[index] ??= []);
          if (list.at(-1) !== start) {
            list.push(start);
          }
        }
        node =
          i < folded.length ? node.next.get(folded.charCodeAt(i)) : undefined;
      }
    }
    return found;
  };
  return {
    size: entries.length,
    always: always.length,
    // How many expressions exist so far; the tests use it to check laziness.
    created: () => regexes.filter(Boolean).length,
    /**
     * Calls `visit(index, match)` for every match of every entry, entry by
     * entry, with the same matches a global `exec` loop would find.
     */
    each(text, visit) {
      for (const [index, starts] of positions(text).entries()) {
        if (starts === undefined) {
          continue;
        }
        const pattern = regex(index);
        if (starts === null) {
          eachGlobal(text, pattern, (match) => visit(index, match));
          continue;
        }
        let end = 0;
        for (const start of starts) {
          if (start < end) {
            continue;
          }
          pattern.lastIndex = start;
          const match = pattern.exec(text);
          if (match) {
            end = start + Math.max(1, match[0].length);
            visit(index, match);
          }
        }
      }
    },
    warm() {
      for (const index of entries.keys()) {
        const pattern = regex(index);
        // Two runs: the first compiles the expression, the second lets V8
        // tier it up before the first real call.
        for (let run = 0; run < 2; run++) {
          pattern.lastIndex = 0;
          pattern.exec('');
        }
      }
    },
  };
}
