import { performance } from 'node:perf_hooks';
import { createSanitizer, sanitizeStream } from '../../src/index.js';
const records = Array.from({ length: 160 }, (_, i) =>
  JSON.stringify({
    id: `req_${i}`,
    type: 'tool_result',
    stdout:
      'Ordinary code review prose about source files and compiler output. '.repeat(
        400
      ),
    password: 'short-private',
  })
);
const input = `${records.join('\n')}\n`;
const engine = createSanitizer({ structured: 'jsonl' });
const start = performance.now();
const result = await engine.sanitize(input);
const elapsed = performance.now() - start;
if (result.text.includes('short-private')) {
  throw new Error('Sensitive value survived');
}
console.log(
  JSON.stringify({
    phase: 'whole',
    bytes: Buffer.byteLength(input),
    elapsed,
    mbps: Buffer.byteLength(input) / 1e6 / (elapsed / 1000),
    rssMiB: process.memoryUsage().rss / 2 ** 20,
  })
);
const streamStart = performance.now();
let output = '';
for await (const chunk of sanitizeStream([input], {
  structured: 'jsonl',
  workers: 2,
  maxRecordBytes: 8 * 1024 * 1024,
})) {
  output += chunk;
}
if (output !== result.text) {
  throw new Error('Stream order or sanitization differs');
}
console.log(
  JSON.stringify({
    phase: 'stream',
    elapsed: performance.now() - streamStart,
    mbps:
      Buffer.byteLength(input) /
      1e6 /
      ((performance.now() - streamStart) / 1000),
    rssMiB: process.memoryUsage().rss / 2 ** 20,
  })
);
