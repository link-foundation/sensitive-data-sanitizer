// Finite adversarial fixture. The parent bounds startup/hangs and heap use;
// measure the scanner's own two-second budget after module initialization.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { detectCredentialFormats } from '../../src/credentials.js';
const input = 'PuTTY-User-Key-File-2:'.repeat(30_000);
const started = performance.now();
let matches = 0;
if (process.argv.includes('--legacy')) {
  const regex =
    /PuTTY-User-Key-File-[23]:[^\r\n]*(?:\r\n|\r|\n)[\s\S]*?(?:Private-MAC:[ \t]*[a-fA-F0-9]+|$)/g;
  matches = [...input.matchAll(regex)].length;
} else {
  detectCredentialFormats(input, () => matches++);
}
const scanMs = performance.now() - started;
if (process.env.CI_SCRIPTS_DEBUG === '1') {
  console.error(JSON.stringify({ initializationMs: started, scanMs }));
}
assert.ok(scanMs < 2000, `PuTTY scan took ${scanMs} ms; limit is 2000 ms`);
console.log(matches);
