// Time the bundled rule scan on a multi-megabyte log, and check that the
// re2-wasm heap survives after every bundled rule has been compiled.
// Run: node experiments/issue-128/large-subject-timing.mjs [MiB]
import { performance } from 'node:perf_hooks';
import {
  betterleaksRules,
  compiledRule,
  detectGitleaks,
  gitleaksRules,
} from '../../src/gitleaks.js';

for (const rule of gitleaksRules) {
  if (rule.regex) {
    compiledRule(`gitleaks/${rule.id}`, rule.regex);
  }
}
for (const rule of betterleaksRules) {
  compiledRule(`betterleaks/${rule.id}`, rule.regex);
}
const mib = Number(process.argv[2] ?? 3);
const line =
  'INFO request id=42 user=alice token=none api status=200 aws github slack key secret password\n';
const text = line.repeat(Math.floor((mib * 1024 * 1024) / line.length));
const start = performance.now();
let found = 0;
detectGitleaks(text, () => found++);
console.log(
  `${mib} MiB: ${found} findings in ${Math.round(performance.now() - start)} ms`
);
