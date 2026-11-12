// Reproduces issue 170: long mixed-case letter runs overflow the V8
// regular-expression backtracking stack in the camelCase key scan.
// Usage: node experiments/issue-170/repro.mjs [MiB] [unit]
import { performance } from 'node:perf_hooks';
import { createSanitizer } from '../../src/index.js';
const mib = Number(process.argv[2] ?? 15);
const unit = process.argv[3] ?? 'A';
const text = `${unit.repeat(
  Math.ceil((mib * 1024 * 1024) / unit.length)
)}\npassword=xx-private-value\n`;
const e = createSanitizer({
  credentialsOnly: true,
  maxInputLength: 64 * 1024 * 1024,
});
const t = performance.now();
try {
  const r = await e.sanitize(text);
  console.log('ok', r.redactions, Math.round(performance.now() - t), 'ms');
} catch (err) {
  console.log(err.code, err.message, err.cause?.message);
}
