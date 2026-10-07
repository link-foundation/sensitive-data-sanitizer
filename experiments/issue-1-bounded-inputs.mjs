// Finite adversarial probes. Run: node --max-old-space-size=256 experiments/issue-1-bounded-inputs.mjs
import { performance } from 'node:perf_hooks';
import { sanitize } from '../src/index.js';

for (const [name, input] of [
  ['long-key-affix', `${'x'.repeat(1024 * 1024)}password=short`],
  ['ordinary-log', 'safe tool output\n'.repeat(32768)],
  [
    'normalized-log',
    `${'safe tool output\n'.repeat(32768)}ｐａｓｓｗｏｒｄ：short`,
  ],
]) {
  const start = performance.now();
  const result = sanitize(input);
  console.log(
    JSON.stringify({
      name,
      characters: input.length,
      milliseconds: Math.round(performance.now() - start),
      redactions: result.redactions,
      heapMiB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    })
  );
}
