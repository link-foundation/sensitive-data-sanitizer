import { performance } from 'node:perf_hooks';
// Compares matchAll, scanMatches (array) and a bare exec loop on short text.
// Run: node experiments/issue-165/scan-loop.mjs
import { scanMatches } from '../../src/detection.js';

const patterns = Array.from(
  { length: 160 },
  (_, i) =>
    new RegExp(
      `(?<![\\p{L}\\p{N}_])(?:word${i}|term${i})[ \\t]*:[ \\t]*(\\S+)`,
      'gu'
    )
);
const values = ['INFO', 'field7', 'value_3_ok', 'metric', 'level'];
function inline(text, pattern) {
  let n = 0;
  pattern.lastIndex = 0;
  while (pattern.exec(text) !== null) {
    n++;
  }
  pattern.lastIndex = 0;
  return n;
}
const ways = {
  matchAll: (t, p) => [...t.matchAll(p)].length,
  scanMatches: (t, p) => [...scanMatches(t, p)].length,
  inline,
};
for (let round = 0; round < 3; round++) {
  for (const [name, fn] of Object.entries(ways)) {
    const start = performance.now();
    for (let i = 0; i < 3000; i++) {
      for (const p of patterns) {
        fn(values[i % 5], p);
      }
    }
    console.log(
      name,
      ((performance.now() - start) / 3000).toFixed(3),
      'ms per value'
    );
  }
}
