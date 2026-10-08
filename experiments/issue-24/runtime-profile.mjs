import { performance } from 'node:perf_hooks';
import { inspect, sanitizeStream } from '../../src/index.js';
import { detectContext } from '../../src/context.js';
import { detectGitleaks } from '../../src/gitleaks.js';
import { nativeDetect } from '../../src/detection.js';

const input = `${'ordinary log record\n'.repeat(27000)}password: secret\n`;
for (const [name, run] of [
  ['context', () => detectContext(input, () => {})],
  ['gitleaks', () => detectGitleaks(input, () => {})],
  ['native', () => nativeDetect(input, {}, () => {})],
  ['inspect', () => inspect(input)],
  [
    'stream',
    async () => {
      for await (const chunk of sanitizeStream([input], {
        secretlint: false,
        batchBytes: 512 * 1024,
      })) {
        if (chunk.includes('password: secret')) {
          throw new Error('Credential survived');
        }
      }
    },
  ],
]) {
  const start = performance.now();
  await run();
  console.log(
    JSON.stringify({
      name,
      elapsed: performance.now() - start,
      bytes: Buffer.byteLength(input),
    })
  );
}
