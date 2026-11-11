import { actionable } from './confidence.js';
import {
  auditFaked,
  mergeSameSpanFindings,
  redactAgain,
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
import { failure, internalFailure } from './detection.js';
import { projectText } from './projection.js';
import { decodedRuns } from './encoded.js';
import { hasCustomTransforms } from './transforms.js';
import { builtInEnabled } from './policy.js';
import { exemptFindingsAsync, escapedExemptionView } from './exempt.js';
import { structuredInspection, withStructuredMemo } from './structured-memo.js';
import {
  initializePlaceholders,
  placeholderKnown,
  hasPlaceholders,
  discardPlaceholderState,
} from './placeholders.js';
import {
  structuredBatches,
  structuredFieldFindings,
  declaredFieldFindings,
  structuredValueViews,
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

const secretlintEngine = { detect: secretlintDetect };
async function detect(engine, text, limit, options) {
  try {
    const found = await engine.detect(text);
    if (!Array.isArray(found)) {
      throw failure('ERR_ENGINE');
    }
    if (found.length > limit) {
      throw failure('ERR_LIMIT');
    }
    return found
      .map((finding) => sanitizeFinding(finding, text.length))
      .filter(
        (finding) =>
          engine !== secretlintEngine || builtInEnabled(finding, options)
      );
  } catch {
    throw failure('ERR_ENGINE');
  }
}

async function engineFindings(engine, projection, options, emit) {
  const limit = options.maxFindings ?? 100000;
  if (projection.changed) {
    for (const f of await detect(engine, projection.text, limit, options)) {
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
      await detect(engine, view, limit, options),
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

async function collectEngineFindings(text, engines, options, emit) {
  const projection = engines.length ? projectText(text) : undefined;
  for (const engine of engines) {
    if (engine !== secretlintEngine && !options.detectors?.includes(engine)) {
      continue;
    }
    for (const finding of await detect(
      engine,
      text,
      options.maxFindings ?? 100000,
      options
    )) {
      emit(finding);
    }
    await engineFindings(engine, projection, options, (finding) => {
      if (builtInEnabled(finding, options)) {
        emit(finding);
      }
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
  // Each distinct view is analyzed a single time per sanitize call.
  const memo = structuredInspection(options);
  const kind = nativeFindings === undefined ? 'async' : 'async-native';
  for (const batch of structuredBatches(text, options)) {
    findings.push(...structuredFieldFindings(batch, options));
    for (const finding of mapStructuredFindings(
      batch,
      await memo(`${kind}-batch`, batch.text, false, () =>
        analyze(
          batch.text,
          [],
          true,
          {
            ...options,
            detectors: [],
            properNames: undefined,
            documentEntities: options.properNames
              ? false
              : options.documentEntities,
          },
          nativeFindings === undefined ? undefined : []
        )
      ).findings,
      options
    )) {
      findings.push(finding);
    }
    for (const view of structuredValueViews(batch, options)) {
      const detected = await memo(`${kind}-value`, view.text, view.prose, () =>
        analyze(
          view.text,
          [],
          true,
          {
            ...options,
            structured: undefined,
            properNames: view.prose ? options.properNames : undefined,
          },
          nativeFindings === undefined ? undefined : []
        )
      ).findings;
      for (const finding of detected) {
        const mapped = view.map(finding);
        if (mapped) {
          findings.push(mapped);
        }
      }
    }
  }
  // Native structured inspection validates, locates and reapplies the
  // same fake-value/public policy to source offsets from all engines.
  return inspectFindingsOnly(
    text,
    [
      ...findings,
      ...declaredFieldFindings(text, options),
      ...(nativeFindings ?? []),
    ],
    {
      ...options,
      findings: initial,
    }
  );
}

function configuredEngines(options) {
  for (const detector of options.detectors ?? []) {
    if (!detector || typeof detector.detect !== 'function') {
      throw failure('ERR_CONFIG');
    }
  }
  const engines =
    options.secretlint === false || options.knownOnly ? [] : [secretlintEngine];
  if (!options.knownOnly) {
    engines.push(...(options.detectors ?? []));
  }
  return engines;
}

async function screenDecodedFindings(text, findings, options, depth, screened) {
  const retained = [];
  for (const finding of findings) {
    const view = escapedExemptionView(text, finding, depth);
    const clean =
      view !== undefined &&
      !(
        await screened(
          view,
          [],
          true,
          { ...options, findings: [], structured: undefined },
          undefined,
          depth + 1
        )
      ).length;
    if (clean) {
      options.debug?.({ event: 'exempt-decoded-view', rule: finding.rule });
    } else {
      retained.push(finding);
    }
  }
  return retained;
}

function createScreened(analyze, options) {
  // The caller's `exempt` hook screens the findings of the text it sees,
  // including the verification passes over the published output.
  return async function screened(
    text,
    initial,
    plain,
    scopedOptions = options,
    nativeFindings,
    exemptionDepth = 0
  ) {
    const findings = await exemptFindingsAsync(
      text,
      await analyze(text, initial, plain, scopedOptions, nativeFindings),
      scopedOptions.exempt
    );
    return scopedOptions.exempt
      ? screenDecodedFindings(
          text,
          findings,
          scopedOptions,
          exemptionDepth,
          screened
        )
      : findings;
  };
}

export function createSanitizer(options = {}) {
  options = applyProfile(options);
  validateOptions(options);
  options = initializePlaceholders(options);
  const engines = configuredEngines(options);
  let prepared;
  async function analyze(
    text,
    initial = options.findings ?? [],
    plain = false,
    scopedOptions = options,
    nativeFindings
  ) {
    const options = placeholderKnown(scopedOptions);
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
    // Native inspection performs its own normalization. Additional views are
    // needed here only when a required external engine is enabled.
    await collectEngineFindings(text, engines, options, emit);
    const detected =
      nativeFindings === undefined
        ? inspect(text, {
            ...options,
            structured: undefined,
            detectors: [],
            exempt: undefined,
            findings,
          })
        : reviewFindings(text, [...nativeFindings, ...findings], options);
    return options.verifyPublic
      ? verifyFindings(text, detected, options.verifyPublic)
      : detected;
  }

  const screened = createScreened(analyze, options);

  const sanitizer = {
    inspect: guarded(async (text) =>
      mergeSameSpanFindings(await screened(text))
    ),
    sanitize: guarded(sanitizeText, () => discardPlaceholderState(options)),
    sanitizeJsonl: (text) =>
      createSanitizer({ ...options, structured: 'jsonl' }).sanitize(text),
  };
  configurations.set(sanitizer, options);
  streamPreparers.set(sanitizer, async (text, nativeFindings) => {
    const findings = await screened(
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
    fullRedaction,
    plain,
    scopedOptions = options,
    round = 0
  ) {
    const options = withStructuredMemo(scopedOptions);
    const findings =
      depth === 0 && prepared?.text === text
        ? prepared.findings
        : await screened(text, options.findings ?? [], plain, options);
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
        sanitizeNested(
          sanitizeText,
          decoded,
          depth,
          fullRedaction,
          recursiveOptions
        )
    );
    if (await customResidual(result.text, options, plain, screened)) {
      throw failure('ERR_RESIDUAL');
    }
    const sanitized = fullRedaction
      ? result.text
      : (
          await redactResultAsync(
            text,
            findings,
            fullOptions,
            (decoded, recursiveOptions) =>
              sanitizeNested(
                sanitizeText,
                decoded,
                depth,
                true,
                recursiveOptions
              )
          )
        ).text;
    // Verification at the publication boundary runs every enabled engine.
    if (
      (await screened(sanitized, [], plain, options)).some((f) =>
        actionable(f, options)
      )
    ) {
      return redactAgain(result, findings, options, round, (next, nextRound) =>
        sanitizeText(result.text, depth, fullRedaction, plain, next, nextRound)
      );
    }
    verifyStructuredResult(result.text, options, plain);
    if (await placeholderResidual(result.text, options, plain, screened)) {
      throw failure('ERR_RESIDUAL');
    }
    return { ...result, findings: auditFaked(findings, options, result) };
  }
}
async function customResidual(text, options, plain, analyze) {
  return (
    hasCustomTransforms(options) &&
    (await analyze(text, [], plain, options)).some((f) =>
      actionable(f, options)
    )
  );
}

function guarded(callback, cleanup = () => {}) {
  return async (...args) => {
    try {
      return await callback(...args);
    } catch (error) {
      throw internalFailure(error);
    } finally {
      cleanup();
    }
  };
}
async function placeholderResidual(text, options, plain, analyze) {
  return (
    hasPlaceholders(options) &&
    (await analyze(text, [], plain, options)).some((f) =>
      actionable(f, options)
    )
  );
}

function eligiblePublic(text, finding, findings) {
  return (
    finding.category !== 'credential' &&
    !['known-personal', 'confirmed-personal'].includes(finding.rule) &&
    ['PERSON', 'ORGANIZATION', 'EDUCATION', 'LOCATION', 'EMAIL'].includes(
      finding.type
    ) &&
    !findings.some(
      (f) =>
        (f.category === 'credential' ||
          ['known-personal', 'confirmed-personal'].includes(f.rule)) &&
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

function sanitizeNested(sanitizeText, decoded, depth, fullRedaction, options) {
  return depth < 2
    ? sanitizeText(decoded, depth + 1, fullRedaction, true, options)
    : Promise.resolve({ text: '[REDACTED]' });
}

function verifyStructuredResult(text, options, plain) {
  if (options.structured && !plain) {
    verifyStructured(text, options);
  }
}
