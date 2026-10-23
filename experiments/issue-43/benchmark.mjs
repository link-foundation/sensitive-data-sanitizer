import { performance } from 'node:perf_hooks';
import { sanitize } from '../../src/index.js';
const size = Number(process.argv[2] ?? 1000000);
if (!Number.isSafeInteger(size) || size < 1 || size > 16000000) {
  throw Error('bounded size required');
}
let state = 43;
const bytes = Buffer.alloc(Math.ceil(size * 0.75));
for (let i = 0; i < bytes.length; i++) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  bytes[i] = state >>> 24;
}
for (const [name, input] of [
  ['repeated', 'A'.repeat(size)],
  ['base64', JSON.stringify({ image: bytes.toString('base64') })],
  [
    'zero-base64',
    JSON.stringify({
      image: Buffer.alloc(Math.ceil(size * 0.75)).toString('base64'),
    }),
  ],
]) {
  const start = performance.now();
  const result = sanitize(input, { maxInputLength: 32 * 1024 * 1024 });
  console.log(
    JSON.stringify({
      name,
      size: input.length,
      ms: performance.now() - start,
      redactions: result.redactions,
      rss: process.memoryUsage().rss,
    })
  );
}
