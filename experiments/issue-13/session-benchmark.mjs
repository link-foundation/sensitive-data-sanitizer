import { performance } from 'node:perf_hooks';
import { createSanitizer } from '../../src/index.js';

// Finite corpus. Run with --max-old-space-size=256 --stack-size=4096.
// Compare batching against downstream's former per-string workaround using
// exactly the same required detector union, including residual verification.
const records = Array.from({ length: 300 }, (_, i) => ({
  id: `req_${i}`,
  type: 'tool_result',
  name: 'Read',
  content: 'A useful ordinary sentence about source files. '.repeat(2),
  password: 'synthetic-short',
}));
const plain = createSanitizer();
const structured = createSanitizer({
  structured: 'jsonl',
  structuralFields: ['id', 'type', 'name'],
});
const input = records.map((record) => JSON.stringify(record)).join('\n');
await plain.sanitize('warm up');
await structured.sanitizeJsonl(JSON.stringify(records[0]));
const start = performance.now();
for (const record of records) {
  for (const [key, value] of Object.entries(record)) {
    await plain.sanitize(`${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  }
}
const perValueMs = performance.now() - start;
const batchedStart = performance.now();
const output = await structured.sanitizeJsonl(input);
const batchedMs = performance.now() - batchedStart;
const parsed = output.text.split('\n').map((line) => JSON.parse(line));
if (
  !parsed.every(
    (record) => record.password === '[REDACTED]' && record.name === 'Read'
  )
) {
  throw new Error('Unexpected session output');
}
console.log(
  JSON.stringify(
    {
      records: records.length,
      bytes: Buffer.byteLength(input),
      perValueMs,
      batchedMs,
      speedup: perValueMs / batchedMs,
      rssMb: process.memoryUsage().rss / 1024 / 1024,
    },
    null,
    2
  )
);
