import { createSanitizer } from '../../src/index.js';

// Finite broad JSON array; run with --max-old-space-size=256 --stack-size=512.
// No recursive JS walk or variadic insertion of all leaf tokens is needed.
const count = 40000;
const input = JSON.stringify(Array.from({ length: count }, () => 'ordinary'));
const result = await createSanitizer({
  structured: 'json',
  secretlint: false,
}).sanitize(input);
if (JSON.parse(result.text).length !== count) {
  throw new Error('Lost array entries');
}
console.log(
  JSON.stringify({
    leaves: count,
    bytes: Buffer.byteLength(input),
    redactions: result.redactions,
    rssMb: process.memoryUsage().rss / 1024 / 1024,
  })
);
