import { failure } from './detection.js';
import { documentDateRange } from './document-dates.js';

const scriptPatterns = new Map();
const dateRange = new RegExp(`\\(${documentDateRange}\\)`, 'u');
const labelSuffix = /[ \t]*:/y;
const commaMobile = /,[ \t]*[78]9\d{9}(?![\p{L}\p{N}_])/u;
const mobile = /^[78]9\d{9}$/u;
const tokenPattern = /[\p{L}\p{M}\p{N}_./:\\?&#%=@+'’~+-]+/gu;
const upper = /[\p{Lu}\p{Lt}]/u;
const quotePairs = new Map([
  ['«', '»'],
  ['“', '”'],
  ['„', '“'],
  ['‘', '’'],
  ['「', '」'],
  ['『', '』'],
]);

function scriptPattern(scripts = ['Cyrillic']) {
  if (
    scripts.some(
      (script) => typeof script !== 'string' || !/^[A-Za-z_]+$/.test(script)
    )
  ) {
    throw failure('ERR_CONFIG');
  }
  const key = scripts.join('|');
  let pattern = scriptPatterns.get(key);
  if (!pattern) {
    // The alias grammar prevents regexp injection; constructing the Unicode
    // property also validates aliases supported by this runtime.
    try {
      pattern = new RegExp(
        scripts.length
          ? `(?=\\p{L})(?:${scripts.map((s) => `\\p{Script=${s}}`).join('|')})`
          : '(?!)',
        'u'
      );
    } catch {
      throw failure('ERR_CONFIG');
    }
    // Bound cache growth when callers submit many different configurations.
    if (scriptPatterns.size >= 64) {
      scriptPatterns.clear();
    }
    scriptPatterns.set(key, pattern);
  }
  return pattern;
}
export function validateProperNames(options) {
  if (
    (options.properNames !== undefined &&
      options.properNames !== 'capitalized') ||
    (options.scripts !== undefined && !Array.isArray(options.scripts))
  ) {
    throw failure('ERR_CONFIG');
  }
  scriptPattern(options.scripts);
}

export function isProseLink(token) {
  return (
    /^https?:\/\/[^/]+/iu.test(token) ||
    /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*\.)+[\p{L}]{2,63}(?:[/:?#]|$)/u.test(token)
  );
}
export function isDocumentShareLink(token) {
  return isProseLink(token) && /\/d\/[^/?#]+/u.test(token);
}
function proseData(text, options) {
  if (
    scriptPattern(options.scripts).test(text) ||
    dateRange.test(text) ||
    commaMobile.test(text)
  ) {
    return true;
  }
  for (const match of text.matchAll(tokenPattern)) {
    if (isDocumentShareLink(match[0])) {
      return true;
    }
  }
  return false;
}
function quotedSpans(text, emit) {
  let start = -1,
    closing;
  for (let i = 0; i < text.length; i++) {
    if (start >= 0) {
      if (text[i] === closing) {
        emit(start, i + 1, 'PROPER_NAME');
        start = -1;
      }
    } else if (quotePairs.has(text[i])) {
      start = i;
      closing = quotePairs.get(text[i]);
    }
  }
}
function pathToken(value) {
  return value.includes('/') || value.includes('\\');
}
export function detectProperNames(text, emit, options) {
  if (options.properNames !== 'capitalized' || !proseData(text, options)) {
    return false;
  }
  let count = 0;
  const found = (start, end, type) => {
    emit({
      start,
      end,
      type,
      rule: 'proper-name-prose',
      category: 'personal',
      confidence: 0.85,
    });
    count++;
  };
  quotedSpans(text, found);
  const ranges = text.matchAll(new RegExp(dateRange, 'gu'));
  let range = ranges.next().value;
  for (const match of text.matchAll(tokenPattern)) {
    const raw = match[0];
    // Leave sentence punctuation outside the replacement. Classification runs
    // once on a maximal token, including hostile tokens without spaces.
    let length = raw.length;
    while (length && (raw[length - 1] === '.' || raw[length - 1] === ':')) {
      length--;
    }
    const value = raw.slice(0, length);
    const start = match.index,
      end = start + value.length;
    while (range && range.index + range[0].length <= start) {
      range = ranges.next().value;
    }
    if (preserveToken(text, raw, value, start, end, range)) {
      continue;
    }
    const type = tokenType(value);
    if (type) {
      found(start, end, type);
    }
  }
  options.debug?.({ event: 'proper-name-prose', count });
  return true;
}

function preserveToken(text, raw, value, start, end, range) {
  labelSuffix.lastIndex = start + raw.length;
  return (
    !value ||
    (range && start >= range.index && end <= range.index + range[0].length) ||
    (value === 'REDACTED' && text[start - 1] === '[' && text[end] === ']') ||
    raw.endsWith(':') ||
    labelSuffix.test(text)
  );
}
function tokenType(value) {
  if (isProseLink(value)) {
    return 'URL';
  }
  if (pathToken(value)) {
    return undefined;
  }
  if (mobile.test(value)) {
    return 'PHONE';
  }
  if (
    upper.test(value) &&
    /\p{L}/u.test(value) &&
    !/^\d{4}-\d{2}-\d{2}/u.test(value)
  ) {
    return 'PROPER_NAME';
  }
  return undefined;
}
