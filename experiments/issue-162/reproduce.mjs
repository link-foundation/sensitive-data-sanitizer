import assert from 'node:assert/strict';
import { createSyncSanitizer } from '../../src/credentials-entry.js';
import { decodedRuns } from '../../src/encoded.js';

const secret = ['gho_', 'SYNTHETIC0000NotARealToken', '1'.repeat(10)].join('');
const engine = createSyncSanitizer({
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
});
const prefix = 'start of output\nresponse body=\n';
const suffix = '\ntrailing line\n';
const raw = Buffer.from(
  JSON.stringify({ token: secret, note: 'keep me' })
).toString('base64');
assert.equal(raw.endsWith('='), false);
for (const width of [20, 40, 46, 64, 76]) {
  const body = raw.match(new RegExp(`.{1,${width}}`, 'g')).join('\n');
  const input = prefix + body + suffix;
  const output = engine.sanitize(input).text;
  assert.ok(output.startsWith(prefix) && output.endsWith(suffix));
  const decoded = Buffer.from(
    output.slice(prefix.length, -suffix.length),
    'base64'
  ).toString();
  assert.deepEqual(JSON.parse(decoded), { token: 'gho…111', note: 'keep me' });
  console.log(
    JSON.stringify({
      width,
      spans: [...decodedRuns(input)].map(({ start, end }) => [start, end]),
      inputLength: input.length,
      outputLength: output.length,
    })
  );
}
