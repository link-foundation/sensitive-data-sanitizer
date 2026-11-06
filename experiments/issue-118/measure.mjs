import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { arch, platform } from 'node:os';
import { URL } from 'node:url';
import { compileKnown, sanitize } from '../../src/index.js';
import { validateOptions } from '../../src/sanitizer.js';
import { detectKnownPersonal } from '../../src/personal-variants.js';

// Fixed, small inputs and iteration counts; run with --max-old-space-size=384.
const corpus = JSON.parse(
  readFileSync(new URL('./ner-corpus.json', import.meta.url), 'utf8')
);
const started = performance.now();
const { createNerDetector } = await import('../../src/ner.js');
const ner = await createNerDetector({ languages: ['ru', 'en'] });
const loadMs = performance.now() - started;
const scores = {};
for (const row of corpus) {
  const actual = ner
    .detect(row.text)
    .map((f) => `${f.type}\0${f.start}\0${f.end}`);
  const expected = row.entities.map(
    ([type, value]) =>
      `${type}\0${row.text.indexOf(value)}\0${row.text.indexOf(value) + value.length}`
  );
  for (const type of ['PERSON', 'ORGANIZATION', 'EDUCATION', 'LOCATION']) {
    const score = (scores[`${row.language}/${type}`] ??= {
      tp: 0,
      fp: 0,
      fn: 0,
    });
    score.tp += actual.filter(
      (v) => v.startsWith(`${type}\0`) && expected.includes(v)
    ).length;
    score.fp += actual.filter(
      (v) => v.startsWith(`${type}\0`) && !expected.includes(v)
    ).length;
    score.fn += expected.filter(
      (v) => v.startsWith(`${type}\0`) && !actual.includes(v)
    ).length;
  }
}
for (const score of Object.values(scores)) {
  score.precision = score.tp / (score.tp + score.fp) || 0;
  score.recall = score.tp / (score.tp + score.fn) || 0;
}
function median(fn, iterations = 15) {
  for (let i = 0; i < 5; i++) {
    fn();
  }
  const samples = [];
  for (let group = 0; group < 5; group++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    samples.push((performance.now() - start) / iterations);
  }
  return samples.sort((a, b) => a - b)[2];
}
const text = 'request completed successfully status ok duration stable\n'
  .repeat(19)
  .slice(0, 1024);
const list = Array.from({ length: 500 }, (_, i) => ({
  type: 'ORGANIZATION',
  value: `PrivateEmployer${String(i).padStart(4, '0')}`,
}));
const known = compileKnown(list);
const base = { profile: 'documents' };
const compiledOptions = { ...base, knownPersonal: known };
const matchingMs = median(
  () =>
    detectKnownPersonal(
      text,
      known,
      'known-personal',
      () => {},
      compiledOptions
    ),
  25
);
const baselineMs = median(() => sanitize(text, base));
const compiledMs = median(() => sanitize(text, compiledOptions));
const plainMs = median(
  () => sanitize(text, { ...base, knownPersonal: list }),
  5
);
const metadataBaselineMs = median(() => validateOptions(base), 100);
const metadataCompiledMs = median(() => validateOptions(compiledOptions), 100);
const nerText = `${'Worked at Romashka for three years. '.repeat(30)}`.slice(
  0,
  1024
);
const result = {
  environment: {
    node: process.version,
    arch: arch(),
    platform: platform(),
    inputBytes: Buffer.byteLength(text),
    rounds: 5,
  },
  compiledKnown: {
    entries: 500,
    baselineMs,
    compiledMs,
    plainMs,
    singleMatchingPassMs: matchingMs,
    metadataBaselineMs,
    metadataCompiledMs,
    metadataOverheadFractionOfBaseline:
      Math.max(0, metadataCompiledMs - metadataBaselineMs) / baselineMs,
  },
  ner: {
    corpusRows: corpus.length,
    exactSpanScores: scores,
    loadMs,
    detectionMsPerKiB: median(() => ner.detect(nerText), 100),
    notes:
      'All corpus rows including challenge misses; exact type and UTF-16 span. Synthetic finite test, not an estimate for arbitrary documents.',
  },
};
writeFileSync(
  new URL(
    '../../docs/case-studies/issue-118/measurements.json',
    import.meta.url
  ),
  `${JSON.stringify(result, null, 2)}\n`
);
console.log(JSON.stringify(result, null, 2));
