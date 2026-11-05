// Finite CodeQL witnesses. Separate scanner speed from cold module startup;
// the parent still bounds hangs and heap use.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { detectIdentity } from '../../src/identity.js';
import { detectPersonal } from '../../src/personal.js';
const kind = process.argv[2];
const prefix = {
  booking: 'booking',
  ticket: 'ticket',
  visa: 'visa',
  postal: '1 Main Street,',
}[kind];
if (!prefix) {
  throw new Error('Choose booking, ticket, visa, or postal');
}
const text = `${prefix}${'\t'.repeat(300_000)}!`;
const started = performance.now();
(kind === 'postal' ? detectPersonal : detectIdentity)(text, () => {});
const scanMs = performance.now() - started;
if (process.env.CI_SCRIPTS_DEBUG === '1') {
  console.error(JSON.stringify({ initializationMs: started, scanMs }));
}
assert.ok(scanMs < 2000, `${kind} scan took ${scanMs} ms; limit is 2000 ms`);
console.log('completed');
