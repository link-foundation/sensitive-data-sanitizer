import { performance } from 'node:perf_hooks';
import { sanitizeStream } from '../../src/index.js';

const records = Number(process.argv[2] ?? 600000);
if (!Number.isSafeInteger(records) || records < 1 || records > 600000) {
  throw new Error('Use 1..600000 finite records');
}
const input = `${'ordinary log record\n'.repeat(records)}password: secret\n`;
const start = performance.now();
let bytes = 0;
for await (const chunk of sanitizeStream([Buffer.from(input)], {
  secretlint: false,
  batchBytes: 512 * 1024,
})) {
  bytes += Buffer.byteLength(chunk);
  console.log(JSON.stringify({ bytes, ms: performance.now() - start }));
}
