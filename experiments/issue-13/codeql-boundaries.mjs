import { performance } from 'node:perf_hooks';
import { structuredBatches, verifyStructured } from '../../src/structured.js';

// Finite reproduction of CodeQL's escaped-quote witness. Run with
// --max-old-space-size=128 --stack-size=512. No unbounded growth loop.
const oldPattern = /"(?:\\[\s\S]|[^"\\])*"|[{}[\],:]/g;
const measurements = [];
for (const count of [2000, 4000, 8000]) {
  const malformed = `"${'\\"'.repeat(count)}`;
  const start = performance.now();
  Array.from(malformed.matchAll(oldPattern));
  const oldMs = performance.now() - start;
  const boundedStart = performance.now();
  let code;
  try {
    structuredBatches(malformed, { structured: 'json' });
  } catch (error) {
    code = error.code;
  }
  if (code !== 'ERR_JSON') {
    throw new Error('Malformed JSON was accepted');
  }
  const invalidMs = performance.now() - boundedStart;
  const valid = JSON.stringify({ content: '\\"{},:[]'.repeat(count) });
  const validStart = performance.now();
  structuredBatches(valid, { structured: 'json' });
  verifyStructured(valid, { structured: 'json' });
  measurements.push({
    count,
    oldMs,
    invalidMs,
    validMs: performance.now() - validStart,
  });
}
console.log(JSON.stringify(measurements, null, 2));
