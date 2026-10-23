import { performance } from 'node:perf_hooks';
import { serviceRules } from '../../src/rules.js';
import { decodedRuns } from '../../src/encoded.js';
import { sanitize } from '../../src/index.js';
const size = Number(process.argv[2] ?? 25000);
if (!Number.isSafeInteger(size) || size < 1 || size > 16 * 1024 * 1024) {
  throw Error('bounded size required');
}
const text = 'A'.repeat(size);
for (const [rule, pattern] of serviceRules) {
  const start = performance.now();
  [...text.matchAll(pattern)];
  console.log(JSON.stringify({ rule, size, ms: performance.now() - start }));
}
let start = performance.now();
[...decodedRuns(text)];
console.log(
  JSON.stringify({ rule: 'decoded', size, ms: performance.now() - start })
);
start = performance.now();
sanitize(text, { maxInputLength: 32 * 1024 * 1024 });
console.log(
  JSON.stringify({ rule: 'sanitize', size, ms: performance.now() - start })
);
