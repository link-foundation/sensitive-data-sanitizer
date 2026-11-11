import { performance } from 'node:perf_hooks';
import { createSyncSanitizer } from '../../src/index.js';
const base = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  transformation: { mode: 'placeholder', map: false },
};
const variants = {
  base,
  empty: { ...base, vocabulary: {} },
  attribute: { ...base, vocabulary: { personalAttributes: ['вепс'] } },
  keep: {
    ...base,
    transformation: { ...base.transformation, existing: 'keep' },
  },
};
const inputs = {
  prose:
    'Работал в компании Ромашка менеджером по продажам с 2019 года. '.repeat(
      16
    ),
  json: '{"level":"INFO","msg":"request completed","ms":12}',
};
const rows = {};
for (const [kind, text] of Object.entries(inputs)) {
  const engines = Object.entries(variants).map(([name, options]) => [
    name,
    createSyncSanitizer({
      ...options,
      ...(kind === 'json' ? { structured: 'json' } : {}),
    }),
  ]);
  const samples = Object.fromEntries(engines.map(([name]) => [name, []]));
  for (let round = 0; round < 5; round++) {
    for (const [name, engine] of engines) {
      engine.sanitize(text);
      const start = performance.now();
      for (let i = 0; i < 8; i++) {
        engine.sanitize(text);
      }
      samples[name].push((performance.now() - start) / 8);
    }
  }
  rows[kind] = Object.fromEntries(
    Object.entries(samples).map(([name, times]) => [
      name,
      Number(times.sort((a, b) => a - b)[2].toFixed(3)),
    ])
  );
}
console.log(
  JSON.stringify(
    { node: process.version, rounds: 5, calls: 8, medianMs: rows },
    null,
    2
  )
);
