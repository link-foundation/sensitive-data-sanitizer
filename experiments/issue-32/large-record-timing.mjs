// Finite 7.38 MB record. Run Node with --max-old-space-size=256 --stack-size=4096.
import { performance } from 'node:perf_hooks';
import { inspect, createSanitizer, sanitizeStream } from '../../src/index.js';
import { streamIdentity } from '../../src/stream-identity.js';

const input = `${JSON.stringify({ stdout: 'ordinary '.repeat(820000), password: 'short-private' })}\n`;
const options = { structured: 'jsonl' };
let start = performance.now();
const findings = inspect(input, options);
console.log({ phase: 'coordinator-inspect', ms: performance.now() - start });
start = performance.now();
streamIdentity(options).prepare(input, findings);
console.log({ phase: 'registry', ms: performance.now() - start });
start = performance.now();
await createSanitizer(options).sanitize(input);
console.log({
  phase: 'required-engine-sanitize',
  ms: performance.now() - start,
});
start = performance.now();
for await (const chunk of sanitizeStream([input, input], {
  ...options,
  workers: 2,
})) {
  if (chunk.includes('short-private')) {
    throw new Error('Credential remained');
  }
}
console.log({
  phase: 'parallel-stream-two-records',
  ms: performance.now() - start,
});
