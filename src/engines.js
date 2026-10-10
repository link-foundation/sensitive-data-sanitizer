import { actionable } from './confidence.js';
import {
  auditFaked,
  inspect,
  redactResultAsync,
  validateOptions,
  validateInput,
  sanitizeFinding,
  validatePublic,
  inspectFindingsOnly,
  reviewFindings,
  markFake,
  applyProfile,
} from './sanitizer.js';
import { failure } from './detection.js';
import { projectText } from './projection.js';
import { decodedRuns } from './encoded.js';
import {
  structuredBatches,
  mapStructuredFindings,
  verifyStructured,
} from './structured.js';

let upstream;
const configurations = new WeakMap();
const streamPreparers = new WeakMap();
export const sanitizerConfiguration = (engine) => configurations.get(engine);
export const prepareStreamEngine = (engine, text, nativeFindings) =>
  streamPreparers.get(engine)?.(text, nativeFindings);
async function secretlintDetect(text) {
  upstream ??= Promise.all([
    import('@secretlint/core'),
    import('@secretlint/secretlint-rule-preset-recommend'),
    import('@secretlint/profiler'),
  ]);
  const [core, preset, profiler] = await upstream;
  profiler.secretLintProfiler.setEnabled(false);
  // Log text is untrusted: embedded disable comments cannot suppress results.
  const rules = preset.rules.filter(
    (rule) => rule.meta.id !== '@secretlint/secretlint-rule-filter-comments'
  );
  const result = await core.lintSource({
    source: {
      filePath: '/virtual/input.txt',
      content: text,
      contentType: 'text',
    },
    options: {
      noPhysicFilePath: true,
      maskSecrets: true,
      config: { rules: rules.map((rule) => ({ id: rule.meta.id, rule })) },
    },
  });
  return result.messages.map((message) => ({
    start: message.range?.[0],
    end: message.range?.[1],
    category: 'credential',
    type: 'SECRET',
    rule: 'secretlint',
  }));
}

async function detect(engine, text, limit) {
  try {
    const found = await engine.detect(text);
    if (!Array.isArray(found)) {
      throw failure('ERR_ENGINE');
    }
    if (found.length > limit) {
      throw failure('ERR_LIMIT');
    }
    return found.map((finding) => sanitizeFinding(finding, text.length));
  } catch {
    throw failure('ERR_ENGINE');
  }
}

async function engineFindings(engine, projection, options, emit) {
  const limit = options.maxFindings ?? 100000;
  if (projection.changed) {
    for (const f of await detect(engine, projection.text, limit)) {
      emit({
        ...f,
        start: projection.starts[f.start],
        end: projection.ends[f.end - 1],
      });
    }
  }
  if (options.decode === false) {
    return;
  }
  for (const run of decodedRuns(projection.text)) {
    if (run.limited) {
      continue;
    }
    const view = projectText(run.text).text;
    const decoded = markFake(
      view,
      await detect(engine, view, limit),
      options
    ).filter((f) => actionable(f, options));
    if (!decoded.length) {
      continue;
    }
    emit({
      start: projection.changed ? projection.starts[run.start] : run.start,
      end: projection.changed ? projection.ends[run.end - 1] : run.end,
      type: 'ENCODED_SENSITIVE',
      category: decoded.some((f) => f.category === 'credential')
        ? 'credential'
        : 'personal',
      rule: 'encoded-engine',
    });
  }
}

async function analyzeStructured(
  text,
  initial,
  options,
  nativeFindings,
  analyze
) {
  const findings = [];
  for (const batch of structuredBatches(text, options)) {
    for (const finding of mapStructuredFindings(
      batch,
      await analyze(
        batch.text,
        [],
        true,
        options,
        nativeFindings === undefined ? undefined : []
      ),
      options
    )) {
      findings.push(finding);
    }
  }
  // Native structured inspection validates, locates and reapplies the
  // same fake-value/public policy to source offsets from all engines.
  return inspectFindingsOnly(text, [...findings, ...(nativeFindings ?? [])], {
    ...options,
    findings: initial,
  });
}

export function createSanitizer(options = {}) {
  options = applyProfile(options);
  validateOptions(options);
  for (const detector of options.detectors ?? []) {
    if (!detector || typeof detector.detect !== 'function') {
      throw failure('ERR_CONFIG');
    }
  }
  const engines =
    options.secretlint === false ? [] : [{ detect: secretlintDetect }];
  engines.push(...(options.detectors ?? []));
  let prepared;
  async function analyze(
    text,
    initial = options.findings ?? [],
    plain = false,
    scopedOptions = options,
    nativeFindings
  ) {
    const options = scopedOptions;
    validateInput(text, options);
    if (options.structured && !plain) {
      return analyzeStructured(text, initial, options, nativeFindings, analyze);
    }
    const findings = [];
    const emit = (finding) => {
      if (findings.length >= (options.maxFindings ?? 100000)) {
        throw failure('ERR_LIMIT');
      }
      findings.push(sanitizeFinding(finding, text.length));
    };
    for (const finding of initial) {
      emit(finding);
    }
    const projection = projectText(text);
    for (const engine of engines) {
      for (const finding of await detect(
        engine,
        text,
        options.maxFindings ?? 100000
      )) {
        emit(finding);
      }
      await engineFindings(engine, projection, options, emit);
    }
    const detected =
      nativeFindings === undefined
        ? inspect(text, { ...options, structured: undefined, findings })
        : reviewFindings(text, [...nativeFindings, ...findings], options);
    return options.verifyPublic
      ? verifyFindings(text, detected, options.verifyPublic)
      : detected;
  }

  const sanitizer = {
    inspect: analyze,
    sanitize: sanitizeText,
    sanitizeJsonl: (text) =>
      createSanitizer({ ...options, structured: 'jsonl' }).sanitize(text),
  };
  configurations.set(sanitizer, options);
  streamPreparers.set(sanitizer, async (text, nativeFindings) => {
    const findings = await analyze(
      text,
      nativeFindings === undefined ? (options.findings ?? []) : [],
      false,
      options,
      nativeFindings
    );
    prepared = { text, findings };
    return findings;
  });
  return sanitizer;
  async function sanitizeText(
    text,
    depth = 0,
    fullRedaction = false,
    plain = false,
    scopedOptions = options
  ) {
    const options = scopedOptions;
    const findings =
      depth === 0 && prepared?.text === text
        ? prepared.findings
        : await analyze(text, options.findings ?? [], plain, options);
    if (depth === 0) {
      prepared = undefined;
    }
    const fullOptions = {
      ...options,
      transformation: undefined,
      transformations: undefined,
      identityMask: false,
      preserveEncoding: false,
    };
    const result = await redactResultAsync(
      text,
      findings,
      fullRedaction ? fullOptions : options,
      (decoded, recursiveOptions) =>
        depth < 2
          ? sanitizeText(
              decoded,
              depth + 1,
              fullRedaction,
              true,
              recursiveOptions
            )
          : Promise.resolve({ text: '[REDACTED]' })
    );
    const sanitized = fullRedaction
      ? result.text
      : (
          await redactResultAsync(
            text,
            findings,
            fullOptions,
            (decoded, recursiveOptions) =>
              depth < 2
                ? sanitizeText(decoded, depth + 1, true, true, recursiveOptions)
                : Promise.resolve({ text: '[REDACTED]' })
          )
        ).text;
    // Verification at the publication boundary runs every enabled engine.
    if (
      (await analyze(sanitized, [], plain, options)).some((f) =>
        actionable(f, options)
      )
    ) {
      throw failure('ERR_RESIDUAL');
    }
    if (options.structured && !plain) {
      verifyStructured(result.text, options);
    }
    return { ...result, findings: auditFaked(findings, options, result) };
  }
}

function eligiblePublic(text, finding, findings) {
  return (
    finding.category !== 'credential' &&
    finding.rule !== 'known-personal' &&
    ['PERSON', 'ORGANIZATION', 'EMAIL'].includes(finding.type) &&
    !findings.some(
      (f) =>
        (f.category === 'credential' || f.rule === 'known-personal') &&
        f.start < finding.end &&
        f.end > finding.start
    ) &&
    !/(?:patient|customer|employee|my name|пациент|клиент)\s*[:=]?\s*$/iu.test(
      text.slice(Math.max(0, finding.start - 64), finding.start)
    )
  );
}
async function verifyFindings(text, findings, verifier) {
  const retained = [];
  for (const finding of findings) {
    if (!eligiblePublic(text, finding, findings)) {
      retained.push(finding);
      continue;
    }
    let verified;
    try {
      verified = await verifier({
        type: finding.type,
        value: text.slice(finding.start, finding.end),
      });
    } catch {
      throw failure('ERR_PUBLIC_VERIFICATION');
    }
    if (!verified) {
      retained.push(finding);
      continue;
    }
    validatePublic(verified);
    if (
      verified.type !== finding.type ||
      verified.value !== text.slice(finding.start, finding.end)
    ) {
      throw failure('ERR_PUBLIC_VERIFICATION');
    }
  }
  return retained;
}
