import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createSyncSanitizer } from '../src/credentials-entry.js';

// Synthetic GHCR-style response inside an escaped JSON tool log.
const credential = `gho_${'A'.repeat(12)}SyntheticNotReal${'9'.repeat(8)}`;
const base64 = (value) => Buffer.from(value).toString('base64');
const record = (value) =>
  `[INFO] "content": ${JSON.stringify(`token len ${credential.length}\n{"token":"${value}"}\n`)}`;
const engine = createSyncSanitizer({
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
});
const sanitized = engine.sanitize(record(base64(credential))).text;
assert.equal(sanitized, record(base64('gho…999')));
assert.equal(engine.sanitize(sanitized).text, sanitized);
console.log(sanitized);
