import { performance } from 'node:perf_hooks';
// Issue 173 reproduction: a credential keyword followed by one long value.
// Usage: node repro.mjs [KiB list, comma-separated]
import { createSyncSanitizer } from '../../src/credentials-entry.js';
const s = createSyncSanitizer({
  credentialsOnly: true,
  preserveEncoding: true,
});
const sizes = (process.argv[2] ?? '64,256').split(',').map(Number);
for (const kib of sizes) {
  const value = 'A'.repeat(kib * 1024);
  for (const [label, text] of [
    ['plain', `${value}\n`],
    ['password=', `password=${value}\n`],
    ['Authorization: Bearer ', `Authorization: Bearer ${value}\n`],
  ]) {
    const t = performance.now();
    s.sanitize(text);
    const ms = Math.round(performance.now() - t);
    console.log(
      kib,
      label,
      ms,
      'ms',
      ((ms * 1000) / text.length).toFixed(2),
      'µs/char'
    );
  }
}
