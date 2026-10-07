import { failure, escapePattern } from './detection.js';
import { codePointRange } from './projection.js';
import { decodedRuns } from './encoded.js';
import { sanitizeFinding } from './sanitizer.js';

function occurrences(text, values, rule) {
  const result = [];
  for (const value of new Set(values)) {
    if (typeof value !== 'string' || !value || /^\*+$/.test(value)) {
      throw failure('ERR_REPORT');
    }
    let found = false;
    for (const match of text.matchAll(new RegExp(escapePattern(value), 'g'))) {
      found = true;
      result.push({
        start: match.index,
        end: match.index + value.length,
        type: 'SECRET',
        category: 'credential',
        rule,
      });
    }
    // Scanners can report decoded values; mask their entire source capsule.
    for (const run of decodedRuns(text)) {
      if (run.text.includes(value)) {
        found = true;
        result.push({
          start: run.start,
          end: run.end,
          type: 'SECRET',
          category: 'credential',
          rule,
        });
      }
    }
    if (!found) {
      throw failure('ERR_REPORT');
    }
  }
  return result;
}

export function fromGitleaks(text, report) {
  if (!Array.isArray(report)) {
    throw failure('ERR_REPORT');
  }
  return occurrences(
    text,
    report.map((entry) => entry.Secret),
    'gitleaks'
  );
}

export function fromTrufflehog(text, report) {
  if (!Array.isArray(report)) {
    throw failure('ERR_REPORT');
  }
  return occurrences(text, report.flatMap(truffleValues), 'trufflehog');
}

function truffleValues(entry) {
  const values = [entry?.Raw, entry?.RawV2];
  if (
    values.some(
      (value) =>
        value !== null && value !== undefined && typeof value !== 'string'
    ) ||
    !values.some((value) => typeof value === 'string' && value.length > 0)
  ) {
    throw failure('ERR_REPORT');
  }
  return values.filter(
    (value) => typeof value === 'string' && value.length > 0
  );
}

export function fromDetectSecrets(text, report, filename) {
  const entries = report?.results?.[filename];
  if (!Array.isArray(entries)) {
    throw failure('ERR_REPORT');
  }
  const lines = text.split('\n');
  const offsets = [0];
  for (const line of lines) {
    offsets.push(offsets.at(-1) + line.length + 1);
  }
  return entries.map((entry) => {
    const index = entry.line_number - 1;
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= lines.length ||
      !lines[index].length
    ) {
      throw failure('ERR_REPORT');
    }
    // Hashed baselines contain no literal secret; redact the complete line.
    return {
      start: offsets[index],
      end: offsets[index] + lines[index].length,
      type: 'SECRET',
      category: 'credential',
      rule: 'detect-secrets',
    };
  });
}

export function fromPresidio(text, report) {
  if (!Array.isArray(report)) {
    throw failure('ERR_REPORT');
  }
  const types = new Set([
    'PERSON',
    'ORGANIZATION',
    'EMAIL_ADDRESS',
    'PHONE_NUMBER',
    'LOCATION',
    'DATE_TIME',
    'CREDIT_CARD',
    'IP_ADDRESS',
    'IBAN_CODE',
    'US_SSN',
    'US_PASSPORT',
    'PASSWORD',
  ]);
  return report.map((entry) => {
    if (
      !types.has(entry.entity_type) &&
      !/^[A-Z]{2}_[A-Z_]{1,50}$/.test(entry.entity_type)
    ) {
      throw failure('ERR_REPORT');
    }
    let range;
    try {
      range = codePointRange(text, entry.start, entry.end);
    } catch {
      throw failure('ERR_REPORT');
    }
    const type =
      {
        EMAIL_ADDRESS: 'EMAIL',
        PHONE_NUMBER: 'PHONE',
        LOCATION: 'ADDRESS',
        PASSWORD: 'SECRET',
      }[entry.entity_type] ?? entry.entity_type;
    return {
      ...range,
      type,
      category: type === 'SECRET' ? 'credential' : 'personal',
      rule: 'presidio',
    };
  });
}

export function byteRange(text, start, end) {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start
  ) {
    throw failure('ERR_REPORT');
  }
  let bytes = 0,
    units = 0;
  const offsets = new Map([[0, 0]]);
  for (const char of text) {
    bytes += Buffer.byteLength(char, 'utf8');
    units += char.length;
    offsets.set(bytes, units);
  }
  if (!offsets.has(start) || !offsets.has(end)) {
    throw failure('ERR_REPORT');
  }
  return { start: offsets.get(start), end: offsets.get(end) };
}

/** Adapt a trusted detector's offset report without retaining quotes or scores. */
export function fromOffsetReport(text, entries, { unit, rule } = {}) {
  if (
    !Array.isArray(entries) ||
    !['utf16', 'codepoint', 'byte'].includes(unit)
  ) {
    throw failure('ERR_REPORT');
  }
  return entries.map((entry) => {
    let range;
    try {
      if (unit === 'byte') {
        range = byteRange(text, entry.start, entry.end);
      } else if (unit === 'codepoint') {
        range = codePointRange(text, entry.start, entry.end);
      } else {
        range = { start: entry.start, end: entry.end };
      }
      return sanitizeFinding(
        { ...range, category: entry.category, type: entry.type, rule },
        text.length
      );
    } catch {
      throw failure('ERR_REPORT');
    }
  });
}
