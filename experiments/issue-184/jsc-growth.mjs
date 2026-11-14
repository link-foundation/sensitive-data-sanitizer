// Bounded comparison of actual sanitize() with the original quadratic
// lookbehind shapes from e804ee5^ (issue 128). No load-generating workers.
// Run with a finite stack and the regex interpreter:
//   (ulimit -s 8192; BUN_JSC_useRegExpJIT=0 bun --smol experiments/issue-184/jsc-growth.mjs)
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { sanitize } from '../../src/index.js';
import { measureGrowth } from '../../tests/helpers/growth.js';

assert.ok(process.versions.bun, 'Run this experiment with Bun');
assert.equal(process.env.BUN_JSC_useRegExpJIT, '0');
const original = [
  [
    '30',
    /(?<![\p{L}\p{N}_])(?<!\p{N}[ \t]*)(?:Mr|Mrs|Ms|Mx|Miss|Dr|Prof)\.?[ \t]+\p{Lu}[\p{Ll}\p{M}]+/gu,
  ],
  ['a,', /(?<=[\p{L}.],[ \t]*)(?:CA|NY)[ \t]+\d{5}/gu],
  [
    'Dear Ms',
    /(?<![\p{L}\p{M}\p{N}_])(?:[Cc]andidate|[Rr]ecruiter|[Aa]pplicant|[Dd]ear|[Hh]i|Mr\.?|(?<!\d[ \t]*)Ms\.?|Dr\.?|[Mm]essage[ \t]+from)[ \t]+[A-Z][a-z]{1,47}/gu,
  ],
];
const elapsed = (scan) => (text) => {
  const start = performance.now();
  scan(text);
  return performance.now() - start;
};
for (const [prefix, regex] of original) {
  const inputs = [4000, 16000].map(
    (length) => `${prefix}${'\t'.repeat(length)}x`
  );
  const current = measureGrowth(elapsed(sanitize), ...inputs);
  const previous = measureGrowth(
    elapsed((text) => [...text.matchAll(regex)]),
    ...inputs
  );
  console.log(JSON.stringify({ prefix, current, previous }));
  assert.ok(current.ratio < 8, `${prefix}: current sanitizer must pass`);
  assert.ok(previous.ratio > 8, `${prefix}: original lookbehind must fail`);
}
