import { performance } from 'node:perf_hooks';
// Fixed cost of one small-value inspection (issue 165).
// Run: node experiments/issue-165/per-value.mjs
import { inspect } from '../../src/index.js';

const options = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
};
const values = ['INFO', 'field7', 'value_3_ok', 'metric', 'level'];
for (let i = 0; i < 200; i++) {
  inspect(values[i % 5], options);
}
const t = performance.now();
const n = 2000;
for (let i = 0; i < n; i++) {
  inspect(values[i % 5], options);
}
console.log('ms per value:', ((performance.now() - t) / n).toFixed(3));
