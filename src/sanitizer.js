import { generatedValues } from './fake.js';
import { alignEscapes } from './escape-spans.js';
import { actionable } from './confidence.js';
import { propagate, confirmationOptions } from './propagation.js';
import { fakeDocumentSpans } from './specimens.js';
import { failure, nativeDetect, REDACTED } from './detection.js';
import { projectText } from './projection.js';
import { decodedRuns, encodeRun, encodedValue } from './encoded.js';
import { URL } from 'node:url';
import { isPublic } from './public.js';
import { validateTransforms, renderReplacement } from './transforms.js';
import { fakeIdentityValue, isIdentityType } from './identity.js';
import {
  structuredBatches,
  mapStructuredFindings,
  verifyStructured,
} from './structured.js';

const fakedResults = new WeakMap();
const publicTypes = new Set(['PERSON', 'ORGANIZATION', 'EMAIL']);
const optionNames = new Set([
  'knownSecrets',
  'knownPersonal',
  'confirmedPersonal',
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
  'identityMask',
  'fakeIdentity',
  'fakeValues',
  'structured',
  'structuralFields',
  'minConfidence',
  'threshold',
  'profile',
]);

export function applyProfile(options = {}) {
  return options?.profile === 'publication'
    ? {
        ...options,
        minConfidence: options.minConfidence ?? options.threshold ?? 0.3,
        identityMask: options.identityMask ?? true,
        fakeIdentity: options.fakeIdentity ?? false,
      }
    : options;
}

function validateCollections(options) {
  for (const key of [
    'knownSecrets',
    'knownPersonal',
    'confirmedPersonal',
    'publicEntities',
    'findings',
    'detectors',
    'fakeValues',
    'structuralFields',
  ]) {
    if (options[key] !== undefined && !Array.isArray(options[key])) {
      throw failure('ERR_CONFIG');
    }
  }
  for (const key of ['knownSecrets', 'fakeValues', 'structuralFields']) {
    if (
      (options[key] ?? []).some((value) => typeof value !== 'string' || !value)
    ) {
      throw failure('ERR_CONFIG');
    }
  }
  for (const entry of [
    ...(options.knownPersonal ?? []),
    ...(options.confirmedPersonal ?? []),
  ]) {
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
  for (const key of [
    'paranoid',
    'decode',
    'secretlint',
    'publicKnowledge',
    'identityMask',
  ]) {
    if (options[key] !== undefined && typeof options[key] !== 'boolean') {
      throw failure('ERR_CONFIG');
    }
  }
  validateConfidence(options);
  validatePolicy(options);
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

function validateConfidence(options) {
  for (const key of ['minConfidence', 'threshold']) {
    if (
      options[key] !== undefined &&
      (typeof options[key] !== 'number' ||
        !Number.isFinite(options[key]) ||
        options[key] < 0 ||
        options[key] > 1)
    ) {
      throw failure('ERR_CONFIG');
    }
  }
  if (
    options.minConfidence !== undefined &&
    options.threshold !== undefined &&
    options.minConfidence !== options.threshold
  ) {
    throw failure('ERR_CONFIG');
  }
}

function validatePolicy(options) {
  for (const [key, values] of [
    ['fakeIdentity', [false, 'specimen-and-synthetic']],
    ['structured', ['json', 'jsonl']],
    ['profile', ['publication']],
  ]) {
    if (options[key] !== undefined && !values.includes(options[key])) {
      throw failure('ERR_CONFIG');
    }
  }
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
    ...(finding.kept === 'fake' ? { kept: 'fake' } : {}),
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
  if (
    finding.category === 'credential' ||
    finding.rule === 'known-personal' ||
    !publicTypes.has(finding.type)
  ) {
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
    if (run.limited) {
      emit({
        start: run.start,
        end: run.end,
        type: 'ENCODED_LIMIT',
        category: 'credential',
        rule: 'encoded-limit',
        confidence: 0.4,
      });
      continue;
    }
    const found = [];
    const view = projectText(run.text).text;
    nativeDetect(view, options, (f) => found.push(f));
    const sensitive = markFake(view, found, options).filter((f) =>
      actionable(f, options)
    );
    if (sensitive.length) {
      emit({
        start: run.start,
        end: run.end,
        type: 'ENCODED_SENSITIVE',
        category: sensitive.some((f) => f.category === 'credential')
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
  options = applyProfile(options);
  validateOptions(options);
  validateInput(text, options);
  if (options.structured) {
    const findings = structuredBatches(text, options).flatMap((batch) =>
      mapStructuredFindings(
        batch,
        inspect(batch.text, {
          ...options,
          structured: undefined,
          findings: [],
        }),
        options
      )
    );
    return inspectFindingsOnly(text, findings, options);
  }
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
    confirmedPersonal: (options.confirmedPersonal ?? []).map((entry) => ({
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
  return reviewFindings(text, findings, options);
}

// Reapply policy to the native/required-engine union without rescanning text.
export function reviewFindings(text, findings, options) {
  if (findings.length > (options.maxFindings ?? 100000)) {
    throw failure('ERR_LIMIT');
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
    markFake(
      text,
      propagate(text, markFake(text, [...unique.values()], options), options),
      options
    ).sort(
      (a, b) =>
        a.start - b.start || b.end - a.end || a.rule.localeCompare(b.rule)
    )
  );
  options.debug?.({ event: 'detected', count: result.length });
  return result;
}

export function inspectFindingsOnly(text, findings, options) {
  const all = [...findings, ...(options.findings ?? [])].map((f) =>
    sanitizeFinding(f, text.length)
  );
  if (all.length > (options.maxFindings ?? 100000)) {
    throw failure('ERR_LIMIT');
  }
  return locations(
    text,
    markFake(
      text,
      propagate(text, markFake(text, all, options), options),
      options
    ).sort((a, b) => a.start - b.start || b.end - a.end)
  );
}

export function markFake(text, findings, options) {
  const generated = generatedValues(options);
  if (
    !options.fakeIdentity &&
    !options.fakeValues?.length &&
    !generated.length
  ) {
    return findings.map((f) => ({ ...f, kept: undefined }));
  }
  const documents = fakeDocumentSpans(text, options);
  const trusted = [];
  for (const record of generated) {
    for (const value of new Set([
      record.value,
      JSON.stringify(record.value).slice(1, -1),
    ])) {
      let start = text.indexOf(value);
      while (start >= 0) {
        trusted.push({
          start,
          end: start + value.length,
          credential: record.credential,
        });
        start = text.indexOf(value, start + value.length);
      }
    }
  }
  const reviewed = [];
  for (const value of options.fakeValues ?? []) {
    let start = text.indexOf(value);
    while (start >= 0) {
      const end = start + value.length;
      if (
        !/[\p{L}\p{N}]/u.test(text[start - 1] ?? '') &&
        !/[\p{L}\p{N}]/u.test(text[end] ?? '')
      ) {
        reviewed.push({ start, end });
      }
      start = text.indexOf(value, end);
    }
  }
  const candidates = findings.filter(
    (f) =>
      f.category === 'personal' &&
      fakeIdentityValue(text.slice(f.start, f.end), f.type, options)
  );
  // Tolerant MRZ matches can cross a line boundary. An automatic specimen
  // exemption must never cover an overlapping real identity value. Exact
  // reviewed values authorize their full span, including contained fragments.
  const safe = [
    ...documents,
    ...reviewed,
    ...candidates.filter(
      (candidate) =>
        options.fakeValues?.includes(
          text.slice(candidate.start, candidate.end)
        ) ||
        !findings.some(
          (other) =>
            isIdentityType(other.type) &&
            other.type !== 'ID' &&
            other.start < candidate.end &&
            other.end > candidate.start &&
            !candidates.includes(other)
        )
    ),
  ];
  return findings.map((f) => {
    if (
      trusted.some(
        (span) =>
          span.start <= f.start &&
          span.end >= f.end &&
          (f.category !== 'credential' || span.credential)
      )
    ) {
      return { ...f, kept: 'fake', faked: true };
    }
    const kept =
      f.category === 'personal' &&
      safe.some((span) => span.start <= f.start && span.end >= f.end) &&
      !findings.some(
        (other) =>
          other.category === 'credential' &&
          other.start < f.end &&
          other.end > f.start
      );
    return kept ? { ...f, kept: 'fake' } : { ...f, kept: undefined };
  });
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
  const sorted = alignEscapes(text, findings)
    .map((f) => sanitizeFinding(f, text.length))
    .map((f) => ({ ...f, kept: undefined }));
  const retained = markFake(text, sorted, options)
    .filter((f) => actionable(f, options))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const spans = [];
  for (const f of retained) {
    const last = spans.at(-1);
    if (last && f.start < last.end) {
      last.end = Math.max(last.end, f.end);
      if (f.category === 'credential') {
        last.category = 'credential';
      }
      if (preferredType(last.type, f.type, options)) {
        last.type = f.type;
      }
    } else {
      spans.push({ ...f });
    }
  }
  return spans;
}

function preferredType(current, candidate, options) {
  if (candidate === 'PHONE' && current !== 'PASSPORT_MRZ') {
    return true;
  }
  if (candidate === 'ENCODED_SENSITIVE') {
    return true;
  }
  if (current === 'ENCODED_SENSITIVE' || options.transformations?.[current]) {
    return false;
  }
  if (options.transformations?.[candidate] || candidate === 'PASSPORT_MRZ') {
    return true;
  }
  const broad = (type) =>
    ['ID', 'PASSPORT'].includes(type) ||
    (/PASSPORT/.test(type) &&
      !['PASSPORT_MRZ', 'PASSPORT_NUMBER'].includes(type));
  return broad(current) && isIdentityType(candidate) && !broad(candidate);
}
export function redactResult(
  text,
  findings,
  options = {},
  replacements = new Map()
) {
  options = applyProfile(options);
  const spans = validatedSpans(text, findings, options);
  const parts = [];
  const faked = [];
  let cursor = 0;
  for (const span of spans) {
    const replacement =
      replacements.get(`${span.start}:${span.end}`) ??
      renderReplacement(text, span, options, (decoded) =>
        sanitize(decoded, {
          ...confirmationOptions(text, findings, options),
          findings: [],
          preserveEncoding: true,
          structured: undefined,
        })
      );
    parts.push(text.slice(cursor, span.start), replacement);
    const transform =
      options.transformations?.[span.type] ?? options.transformation;
    if (
      transform?.mode === 'fake' &&
      replacement !== REDACTED &&
      (span.category === 'personal' || transform.credentials)
    ) {
      faked.push(span);
    }
    cursor = span.end;
  }
  parts.push(text.slice(cursor));
  const result = { text: parts.join(''), redactions: spans.length };
  fakedResults.set(result, faked);
  return result;
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
      const result = await sanitizeDecoded(
        run.text,
        confirmationOptions(text, findings, options)
      );
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
  options = applyProfile(options);
  const findings = inspect(text, options);
  const result = redactResult(text, findings, options);
  const sanitized = redactResult(text, findings, {
    ...options,
    transformation: undefined,
    transformations: undefined,
    identityMask: false,
    preserveEncoding: false,
  }).text;
  if (
    inspect(sanitized, { ...options, findings: [] }).some((f) =>
      actionable(f, options)
    )
  ) {
    throw failure('ERR_RESIDUAL');
  }
  if (options.structured) {
    verifyStructured(result.text, options);
  }
  return { ...result, findings: auditFaked(findings, options, result) };
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

export function auditFaked(findings, options, result) {
  const spans = fakedResults.get(result) ?? [];
  return findings.map((f) =>
    actionable(f, options) &&
    spans.some((span) => span.start <= f.start && span.end >= f.end)
      ? { ...f, faked: true }
      : f
  );
}
