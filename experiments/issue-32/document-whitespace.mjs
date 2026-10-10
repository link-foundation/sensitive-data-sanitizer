import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { sanitize } from '../../src/index.js';

// A finite regression for CodeQL's filename-guard whitespace finding.
// The test parent caps startup/work deadlines and the child heap/stack.
const text = `QAZVELA_ZORVETA_PASSPORT${'\t'.repeat(128 * 1024)}tail`;
process.send?.({ event: 'ready' });
const started = performance.now();
const output = sanitize(text).text;
assert(!output.includes('QAZVELA'));
assert(output.endsWith('tail'));
console.log(
  JSON.stringify({
    bytes: text.length,
    milliseconds: performance.now() - started,
  })
);
