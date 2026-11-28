import assert from 'node:assert/strict';
import { sanitizeStream } from '../../src/index.js';

const chunk = Buffer.alloc(64 * 1024, 32);
const chunks = 256;
const credential = 'synthetic-fixture-secret';
async function* input() {
  yield 'Before.\n';
  yield chunk;
  yield `${' '.repeat(1018)}${credential}`;
  for (let index = 1; index < chunks; index++) {
    yield chunk;
  }
  yield '\nAfter.\n';
}

let output = '';
for await (const record of sanitizeStream(input(), {
  oversizedRecords: 'redact',
  maxRecordBytes: chunk.length + 1024,
  maxTotalBytes: chunk.length * (chunks + 1),
  credentialsOnly: true,
  knownSecrets: [credential],
  secretlint: false,
})) {
  output += record;
  assert.ok(output.length < 100);
}
assert.equal(output, 'Before.\n[REDACTED]\nAfter.\n');
