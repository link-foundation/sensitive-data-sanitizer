// Issue 170: sanitizes one random single-line base64 blob of the given sizes
// with the sanitizer from a source tree, in default and credentialsOnly mode.
// Usage: node experiments/issue-170/base64-limit.mjs <src dir> [KiB,...]
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const dir = path.resolve(process.argv[2] ?? 'src');
const { createSanitizer } = await import(
  pathToFileURL(path.join(dir, 'index.js')).href
);
const sizes = (process.argv[3] ?? '256,1024,4096,10240').split(',').map(Number);
for (const kib of sizes) {
  const blob = randomBytes(kib * 768).toString('base64');
  const text = `${blob}\npassword=xx-private-value\n`;
  for (const credentialsOnly of [false, true]) {
    const started = performance.now();
    let result;
    try {
      const out = await createSanitizer({
        credentialsOnly,
        maxInputLength: 64 * 1024 * 1024,
      }).sanitize(text);
      result = out.text.includes('xx-private-value') ? 'LEAK' : 'ok';
    } catch (error) {
      result = error.code ?? error.message;
    }
    const ms = Math.round(performance.now() - started);
    console.log(kib, credentialsOnly ? 'credentials' : 'default', result, ms);
  }
}
