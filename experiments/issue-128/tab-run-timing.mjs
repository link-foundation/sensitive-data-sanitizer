// Time sanitize() on a label followed by a long tab run, per runtime.
// Run: node|bun|deno run -A experiments/issue-128/tab-run-timing.mjs [tabs]
import { performance } from 'node:perf_hooks';
import { sanitize } from '../../src/index.js';

const tabs = Number(globalThis.process?.argv?.[2] ?? 60000);
for (const label of ['', 'plain', 'SSN', 'ZIP code']) {
  for (const sep of ['\t', ' ']) {
    const start = performance.now();
    sanitize(`${label}${sep.repeat(tabs)}x`);
    const name = sep === '\t' ? 'tabs' : 'spaces';
    console.log(
      `${JSON.stringify(label)} + ${tabs} ${name}: ${Math.round(performance.now() - start)} ms`
    );
  }
}
