// Finite adversarial input; run with node --max-old-space-size=256.
import { performance } from 'node:perf_hooks';
import { keptPlaceholderSpans } from '../../src/placeholders.js';
const options = { transformation: { mode: 'placeholder', existing: 'keep' } };
for (const length of [1024, 4096, 16384]) {
  const input = 'A'.repeat(length);
  const start = performance.now();
  const spans = keptPlaceholderSpans(input, [], options);
  console.log(
    JSON.stringify({
      length,
      milliseconds: performance.now() - start,
      spans: spans.length,
    })
  );
}
