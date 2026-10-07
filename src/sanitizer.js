import { failure, nativeDetect } from './detection.js';
import { projectText } from './projection.js';
import { decodedRuns, encodeRun, encodedValue } from './encoded.js';
import { URL } from 'node:url';
import { isPublic } from './public.js';
import { validateTransforms, renderReplacement } from './transforms.js';

const publicTypes = new Set(['PERSON', 'ORGANIZATION', 'EMAIL']);
const optionNames = new Set([
  'knownSecrets',
  'knownPersonal',
  'publicEntities',
  'findings',
  'paranoid',
  'decode',
  'maxInputLength',
  'maxFindings',
  'debug',
  'detectors',
  'secretlint',
  'publicKnowledge',
  'transformation',
  'transformations',
  'preserveEncoding',
  'verifyPublic',
]);

function validateCollections(options) {
  for (const key of [
    'knownSecrets',
    'knownPersonal',
    'publicEntities',
    'findings',
    'detectors',
  ]) {
    if (options[key] !== undefined && !Array.isArray(options[key])) {
      throw failure('ERR_CONFIG');
    }
  }
  for (const value of options.knownSecrets ?? []) {
    if (typeof value !== 'string' || value.length === 0) {
      throw failure('ERR_CONFIG');
    }
  }
  for (const entry of options.knownPersonal ?? []) {
    if (
      !entry ||
      typeof entry.value !== 'string' ||
      !entry.value ||
      !validType(entry.type)
    ) {
      throw failure('ERR_CONFIG');
    }
  }
}

export function validatePublic(entry) {
  if (
    !entry ||
    !publicTypes.has(entry.type) ||
    typeof entry.value !== 'string' ||
    !entry.value ||
    typeof entry.source !== 'string' ||
    typeof entry.reviewedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt)
  ) {
    throw failure('ERR_CONFIG');
  }
  const reviewedAt = new Date(entry.reviewedAt);
  if (
    Number.isNaN(reviewedAt.getTime()) ||
    reviewedAt.toISOString().slice(0, 10) !== entry.reviewedAt
  ) {
    throw failure('ERR_CONFIG');
  }
  let url;
  try {
    url = new URL(entry.source);
  } catch {
    throw failure('ERR_CONFIG');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw failure('ERR_CONFIG');
  }
}

export function validateOptions(options = {}) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options) ||
    Object.keys(options).some((k) => !optionNames.has(k))
  ) {
    throw failure('ERR_CONFIG');
  }
  for (const key of ['paranoid', 'decode', 'secretlint', 'publicKnowledge']) {
    if (options[key] !== undefined && typeof options[key] !== 'boolean') {
      throw failure('ERR_CONFIG');
    }
  }
  if (
    options.verifyPublic !== undefined &&
    typeof options.verifyPublic !== 'function'
  ) {
    throw failure('ERR_CONFIG');
  }
  validateCollections(options);
  validateTransforms(options);
  validateLimits(options);
  for (const entry of options.publicEntities ?? []) {
    validatePublic(entry);
  }
  return options;
}

function validType(value) {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(value);
}

export function validateInput(text, options) {
  if (typeof text !== 'string') {
    throw failure('ERR_INPUT');
  }
  if (text.length > (options.maxInputLength ?? 10 * 1024 * 1024)) {
    throw failure('ERR_LIMIT');
  }
}

export function sanitizeFinding(finding, length) {
  if (
    !finding ||
    !Number.isInteger(finding.start) ||
    !Number.isInteger(finding.end) ||
    finding.start < 0 ||
    finding.end > length ||
    finding.end <= finding.start ||
    !validType(finding.type) ||
    !['personal', 'credential'].includes(finding.category) ||
    typeof finding.rule !== 'string' ||
    !/^[a-z0-9@/._-]{1,120}$/.test(finding.rule)
  ) {
    throw failure('ERR_FINDING');
  }
  return {
    start: finding.start,
    end: finding.end,
    type: finding.type,
    category: finding.category,
    rule: finding.rule,
    confidence: validConfidence(finding),
    likelihood: finding.likelihood ?? likelihood(validConfidence(finding)),
  };
}

function validConfidence(finding) {
  const confidence =
    finding.confidence ?? (finding.category === 'credential' ? 0.95 : 0.85);
  if (
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1 ||
    (finding.likelihood &&
      ![
        'VERY_UNLIKELY',
        'UNLIKELY',
        'POSSIBLE',
        'LIKELY',
        'VERY_LIKELY',
      ].includes(finding.likelihood))
  ) {
    throw failure('ERR_FINDING');
  }
  return confidence;
}
function likelihood(confidence) {
  return confidence >= 0.9
    ? 'VERY_LIKELY'
    : confidence >= 0.7
      ? 'LIKELY'
      : confidence >= 0.4
        ? 'POSSIBLE'
        : confidence >= 0.2
          ? 'UNLIKELY'
          : 'VERY_UNLIKELY';
}

function allowed(text, finding, policy) {
  if (finding.category === 'credential' || !publicTypes.has(finding.type)) {
    return false;
  }
  const value = text.slice(finding.start, finding.end).normalize('NFC');
  return policy.some(
    (entry) =>
      entry.type === finding.type && entry.value.normalize('NFC') === value
  );
}

function encodedDetect(text, options, emit) {
  if (options.decode === false) {
    return;
  }
  for (const run of decodedRuns(text)) {
    const found = [];
    nativeDetect(projectText(run.text).text, options, (f) => found.push(f));
    if (found.length) {
      emit({
        start: run.start,
        end: run.end,
        type: 'ENCODED_SENSITIVE',
        category: found.some((f) => f.category === 'credential')
          ? 'credential'
          : 'personal',
        rule: 'encoded',
      });
    }
  }
}

function locations(text, findings) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      starts.push(i + 1);
    }
  }
  return findings.map((f) => {
    let lo = 0,
      hi = starts.length;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (starts[mid] <= f.start) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return { ...f, line: lo + 1, column: f.start - starts[lo] + 1 };
  });
}

export function inspect(text, options = {}) {
  validateOptions(options);
  validateInput(text, options);
  const findings = [];
  const emit = (f) => {
    if (findings.length >= (options.maxFindings ?? 100000)) {
      throw failure('ERR_LIMIT');
    }
    findings.push(sanitizeFinding(f, text.length));
  };
  const projection = projectText(text);
  const nativeOptions = {
    ...options,
    knownSecrets: (options.knownSecrets ?? []).map(
      (value) => projectText(value).text
    ),
    knownPersonal: (options.knownPersonal ?? []).map((entry) => ({
      ...entry,
      value: projectText(entry.value).text,
    })),
  };
  const mapped = (f) =>
    emit(
      projection.changed
        ? {
            ...f,
            start: projection.starts[f.start],
            end: projection.ends[f.end - 1],
          }
        : f
    );
  if (projection.changed) {
    nativeDetect(text, options, emit);
  }
  nativeDetect(projection.text, nativeOptions, mapped);
  encodedDetect(projection.text, nativeOptions, mapped);
  for (const f of options.findings ?? []) {
    emit(f);
  }
  const unique = new Map();
  for (const f of findings) {
    if (
      !allowed(text, f, options.publicEntities ?? []) &&
      !isPublic(text, f, options)
    ) {
      unique.set(`${f.start}:${f.end}:${f.category}:${f.type}:${f.rule}`, f);
    }
  }
  const result = locations(
    text,
    [...unique.values()].sort(
      (a, b) =>
        a.start - b.start || b.end - a.end || a.rule.localeCompare(b.rule)
    )
  );
  options.debug?.({ event: 'detected', count: result.length });
  return result;
}

function validatedSpans(text, findings, options) {
  validateOptions(options);
  validateInput(text, options);
  if (
    !Array.isArray(findings) ||
    findings.length > (options.maxFindings ?? 100000)
  ) {
    throw failure('ERR_FINDING');
  }
  const sorted = findings
    .map((f) => sanitizeFinding(f, text.length))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const spans = [];
  for (const f of sorted) {
    const last = spans.at(-1);
    if (last && f.start < last.end) {
      last.end = Math.max(last.end, f.end);
      if (f.category === 'credential') {
        last.category = 'credential';
      }
      if (f.type === 'ENCODED_SENSITIVE') {
        last.type = f.type;
      }
    } else {
      spans.push({ ...f });
    }
  }
  return spans;
}
export function redactResult(
  text,
  findings,
  options = {},
  replacements = new Map()
) {
  const spans = validatedSpans(text, findings, options);
  const parts = [];
  let cursor = 0;
  for (const span of spans) {
    parts.push(
      text.slice(cursor, span.start),
      replacements.get(`${span.start}:${span.end}`) ??
        renderReplacement(text, span, options, (decoded) =>
          sanitize(decoded, {
            ...options,
            findings: [],
            preserveEncoding: true,
          })
        )
    );
    cursor = span.end;
  }
  parts.push(text.slice(cursor));
  return { text: parts.join(''), redactions: spans.length };
}

export async function redactResultAsync(
  text,
  findings,
  options,
  sanitizeDecoded
) {
  const replacements = new Map();
  {
    for (const span of validatedSpans(text, findings, options)) {
      if (span.type !== 'ENCODED_SENSITIVE') {
        continue;
      }
      const run = encodedValue(text.slice(span.start, span.end));
      if (!run) {
        if (options.preserveEncoding) {
          throw failure('ERR_ENCODING');
        }
        continue;
      }
      if (!options.preserveEncoding && run.encoding !== 'json-content') {
        continue;
      }
      const result = await sanitizeDecoded(run.text);
      replacements.set(
        `${span.start}:${span.end}`,
        encodeRun(run, result.text)
      );
    }
  }
  return redactResult(text, findings, options, replacements);
}

export function redact(text, findings, options = {}) {
  return redactResult(text, findings, options).text;
}

export function sanitize(text, options = {}) {
  const findings = inspect(text, options);
  const result = redactResult(text, findings, options);
  const sanitized = redactResult(text, findings, {
    ...options,
    transformation: undefined,
    transformations: undefined,
    preserveEncoding: false,
  }).text;
  if (inspect(sanitized, { ...options, findings: [] }).length) {
    throw failure('ERR_RESIDUAL');
  }
  return { ...result, findings };
}

function validateLimits(options) {
  for (const key of ['maxInputLength', 'maxFindings']) {
    if (
      options[key] !== undefined &&
      (!Number.isSafeInteger(options[key]) || options[key] <= 0)
    ) {
      throw failure('ERR_CONFIG');
    }
  }
  if (options.debug !== undefined && typeof options.debug !== 'function') {
    throw failure('ERR_CONFIG');
  }
}
