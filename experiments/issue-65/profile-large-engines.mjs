// Finite scan comparison. Run with node --max-old-space-size=512.
import { performance } from 'node:perf_hooks';
import { createSanitizer } from '../../src/index.js';
import { detectGitleaks } from '../../src/gitleaks.js';
const mode = process.argv[2] ?? 'gitleaks';
const start = performance.now();
if (mode === 'gitleaks') {
  const input = `ext ${'A'.repeat(9600000)}\npassword = "${'AbCd0123456789ef'.repeat(70000)}"\n`;
  const trace = [];
  detectGitleaks(
    input,
    () => {},
    (event) => trace.push(event)
  );
  console.log(trace.sort((a, b) => b.ms - a.ms).slice(0, 6));
} else {
  const input = JSON.stringify({
    stdout: `ordinary ${' '.repeat(7 * 1024 * 1024)}`,
    password: 'short-private',
  });
  await createSanitizer({
    structured: 'json',
    secretlint: mode !== 'native',
  }).sanitize(input);
}
console.log({ mode, ms: performance.now() - start });
