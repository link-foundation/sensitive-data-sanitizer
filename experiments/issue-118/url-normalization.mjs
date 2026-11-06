import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { compileKnown, sanitize } from '../../src/index.js';

// Finite adversarial suffixes from the CodeQL findings. Run with a 384 MiB heap:
// node --max-old-space-size=384 experiments/issue-118/url-normalization.mjs
const count = 8192;
const started = performance.now();
for (const suffix of ['#'.repeat(count), '/'.repeat(count)]) {
  const known = compileKnown([
    { type: 'URL', value: `https://example.org/anna${suffix}` },
  ]);
  assert.equal(
    sanitize('example.org/anna/?x=1', {
      knownPersonal: known,
      knownOnly: true,
    }).text,
    '[REDACTED]'
  );
}
console.log({ suffixLength: count, milliseconds: performance.now() - started });
