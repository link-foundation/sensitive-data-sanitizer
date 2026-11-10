// Rank regexes by time spent on a long whitespace run. Under Bun, disable
// the JavaScriptCore regex JIT to see interpreter (worst-case) behaviour:
//   BUN_JSC_useRegExpJIT=0 bun experiments/issue-128/regex-cost.mjs 4000
//   node experiments/issue-128/regex-cost.mjs 4000
import { performance } from 'node:perf_hooks';
import { sanitize } from '../../src/index.js';

const run = Number(globalThis.process?.argv?.[2] ?? 4000);
const cost = new Map();
const exec = RegExp.prototype.exec;
RegExp.prototype.exec = function (input) {
  const start = performance.now();
  try {
    return exec.call(this, input);
  } finally {
    const key = `/${this.source}/${this.flags}`;
    cost.set(key, (cost.get(key) ?? 0) + performance.now() - start);
  }
};
for (const text of [
  `plain${'\t'.repeat(run)}x`,
  `30${' '.repeat(run)}x`,
  `a,${'\t'.repeat(run)}x`,
  `Line\n${' '.repeat(run)}x`,
]) {
  const start = performance.now();
  sanitize(text);
  console.log(
    `${JSON.stringify(text.slice(0, 6))}: ${Math.round(performance.now() - start)} ms`
  );
}
RegExp.prototype.exec = exec;
for (const [source, ms] of [...cost].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`${Math.round(ms)} ms  ${source.slice(0, 160)}`);
}
