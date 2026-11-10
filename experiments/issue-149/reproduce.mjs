import { Buffer } from 'node:buffer';
import { decodedRuns } from '../../src/encoded.js';
import { createSyncSanitizer } from '../../src/credentials-entry.js';
const engine = createSyncSanitizer({
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
});
const secret = ['gho_', 'SYNTHETIC0000NotARealToken11111111111'].join('');
const json = JSON.stringify({ token: secret, note: 'keep me' });
const wrapped = Buffer.from(json)
  .toString('base64')
  .match(/.{1,20}/g)
  .join('\n');
const input = `start of output\nresponse body=\n${wrapped}\ntrailing line\n`;
console.log('runs:', [...decodedRuns(input)]);
console.log('output:', engine.sanitize(input).text);
const binary = `${Buffer.alloc(150000, 147)
  .toString('base64')
  .match(/.{1,76}/g)
  .join('\n')}\n`;
console.log(
  'binary lengths:',
  binary.length,
  engine.sanitize(binary).text.length
);
