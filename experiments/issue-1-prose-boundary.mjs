import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { valueRange } from '../src/context.js';

// Finite hostile whitespace. Run with a bounded child deadline and JS heap.
const text = `phrase${'\t'.repeat(128 * 1024)}suffix for the server`;
process.send?.({ event: 'ready' });
const started = performance.now();
assert.deepEqual(valueRange(text, 0, 'prose'), {
  start: 0,
  end: text.indexOf(' for the'),
});
console.log(
  JSON.stringify({
    bytes: text.length,
    milliseconds: performance.now() - started,
  })
);
