import { failure } from './detection.js';
import { documentDateRange } from './document-dates.js';
import { keepsProseWord } from './prose-words.js';
import { flatRegExp } from './unicode-runs.js';

const scriptPatterns = new Map();
const dateRange = new RegExp(`\\(${documentDateRange}\\)`, 'u');
const commaMobile = /,[ \t]*[78]9\d{9}(?![\p{L}\p{N}_])/u;
const mobile = /^[78]9\d{9}$/u;
const tokenPattern = flatRegExp(/[\p{L}\p{M}\p{N}_./:\\?&#%=@+'’~+-]+/gu);
const upper = /[\p{Lu}\p{Lt}]/u;
// Only known labels are exempt before colons in activated Cyrillic prose.
const proseLabels = new Set(
  'опыт стаж навыки образование компания работодатель должность обязанности достижения проекты контакты телефон почта адрес возраст пол гражданство дети национальность вероисповедание инвалидность судимость резюме имя фамилия отчество город статус дата время уровень языки интересы о себе место работы семейное положение'.split(
    ' '
  )
);
const completeTypes = new Set([
  'EMAIL',
  'PHONE',
  'ID',
  'VIN',
  'PASSPORT_NUMBER',
]);
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
// Compact typed document findings, such as `ООО «Ромашка»` after `работал в`
// or `Казани` after `живу в`, name what the prose tokens inside them are.
const typedDocumentTypes = new Set([
  'ORGANIZATION',
  'LOCATION',
  'EDUCATION',
  'PERSON',
]);
function compactTyped(text, finding) {
  return (
    typedDocumentTypes.has(finding.type) &&
    finding.end - finding.start <= 160 &&
    !/[\t\r\n]/u.test(text.slice(finding.start, finding.end))
  );
}
// Keep existing document coverage outside the new replacements. Two naturally
// ordered runs (quotes, then tokens) provide an interval index without sorting.
// Overlapping broad document spans must not merge separate prose replacements.
export function detectProseAndDocuments(text, emit, options, detectDocuments) {
  if (options.properNames !== 'capitalized') {
    detectDocuments(text, emit, options);
    return;
  }
  const runs = [[]];
  let complete = 0,
    suppressed = 0;
  detectProperNames(
    text,
    (finding) => {
      if (runs.at(-1).at(-1)?.end > finding.start) {
        runs.push([]);
      }
      runs.at(-1).push(finding);
    },
    options
  );
  const covered = new Set();
  detectDocuments(
    text,
    (finding) => {
      const overlapping = runs.flatMap((run) => overlapsRun(run, finding));
      if (completeTypes.has(finding.type)) {
        // Contacts and identifiers are indivisible: a domain or series alone
        // cannot safely replace the complete value detected by document rules.
        emit(finding);
        complete++;
      } else if (!overlapping.length) {
        emit(finding);
      } else if (
        compactTyped(text, finding) &&
        overlapping.every(
          (prose) => prose.start >= finding.start && prose.end <= finding.end
        )
      ) {
        emit(finding);
        overlapping.forEach((prose) => covered.add(prose));
      } else {
        suppressed++;
      }
    },
    options
  );
  for (const finding of runs.flat()) {
    if (!covered.has(finding)) {
      emit(finding);
    }
  }
  options.debug?.({
    event: 'document-prose-overlap',
    complete,
    suppressed,
    typed: covered.size,
  });
}
// The prose findings of one ordered run that overlap a document finding.
function overlapsRun(run, finding) {
  let low = 0,
    high = run.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (run[mid].end <= finding.start) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  const overlapping = [];
  for (let i = low; i < run.length && run[i].start < finding.end; i++) {
    overlapping.push(run[i]);
  }
  return overlapping;
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
    if (
      preserveToken(text, raw, value, start, end, range) ||
      keepsProseWord(text, value, start, end, options)
    ) {
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
  let next = start + raw.length;
  while (text[next] === ' ' || text[next] === '\t') {
    next++;
  }
  return (
    !value ||
    (range && start >= range.index && end <= range.index + range[0].length) ||
    (value === 'REDACTED' && text[start - 1] === '[' && text[end] === ']') ||
    ((raw.endsWith(':') || text[next] === ':') &&
      (!/^[А-ЯЁа-яё-]+$/u.test(value) || proseLabels.has(value.toLowerCase())))
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
