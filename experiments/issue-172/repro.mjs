import { performance } from 'node:perf_hooks';
// Issue 172 reproduction through the public API.
import { createSanitizer } from '../../src/index.js';
const e = createSanitizer({
  credentialsOnly: true,
  maxInputLength: 64 * 1024 * 1024,
});
const mib = Number(process.argv[2] ?? 4);
const run = 'Ab'.repeat(mib * 512 * 1024);
for (const [name, tail] of [
  ['emoji + token', '\n🔐 token refreshed\n'],
  ['hive mask (second pass)', '\npassword=xx-…789\n'],
  ['Latin-1 only', '\nauth é ok\n'],
]) {
  const t = performance.now();
  try {
    console.log(
      name,
      'ok',
      (await e.sanitize(run + tail)).redactions,
      Math.round(performance.now() - t),
      'ms'
    );
  } catch (err) {
    console.log(name, err.code, err.cause?.message ?? '');
  }
}
