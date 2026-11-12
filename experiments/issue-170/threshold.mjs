// Finds the run sizes at which detectContext fails or slows down (issue 170).
// Usage: node threshold.mjs [module path]
import { URL } from 'node:url';
import { performance } from 'node:perf_hooks';
const path = process.argv[2] ?? '../../src/context.js';
const { detectContext } = await import(new URL(path, import.meta.url));
for (const unit of ['A', 'Ab', 'aB', 'A_', 'a-', 'a.']) {
  for (const kib of (process.env.SIZES ?? '256,1024,2048,4096')
    .split(',')
    .map(Number)) {
    const text = `${unit.repeat((kib * 1024) / unit.length)}\npassword=xx-private-value\n`;
    const t = performance.now();
    let r;
    try {
      const found = [];
      detectContext(text, (f) => found.push(f), true);
      r = `ok ${found.length}`;
    } catch (error) {
      r = error.message;
    }
    const ms = Math.round(performance.now() - t);
    console.log(unit, kib, 'KiB', r, ms, 'ms');
    if (ms > 20000) {
      break;
    }
  }
}
