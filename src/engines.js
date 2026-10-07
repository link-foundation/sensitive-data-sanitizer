import {
  inspect,
  redactResult,
  validateOptions,
  validateInput,
  sanitizeFinding,
} from './sanitizer.js';
import { failure } from './detection.js';
import { projectText } from './projection.js';
import { decodedRuns } from './encoded.js';

let upstream;
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
    const decoded = await detect(engine, projectText(run.text).text, limit);
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

export function createSanitizer(options = {}) {
  validateOptions(options);
  for (const detector of options.detectors ?? []) {
    if (!detector || typeof detector.detect !== 'function') {
      throw failure('ERR_CONFIG');
    }
  }
  const engines =
    options.secretlint === false ? [] : [{ detect: secretlintDetect }];
  engines.push(...(options.detectors ?? []));
  async function analyze(text, initial = options.findings ?? []) {
    validateInput(text, options);
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
    return inspect(text, { ...options, findings });
  }
  return {
    inspect: analyze,
    async sanitize(text) {
      const findings = await analyze(text);
      const result = redactResult(text, findings, options);
      const sanitized = result.text;
      // Verification at the publication boundary runs every enabled engine.
      if ((await analyze(sanitized, [])).length) {
        throw failure('ERR_RESIDUAL');
      }
      return { ...result, findings };
    },
  };
}
