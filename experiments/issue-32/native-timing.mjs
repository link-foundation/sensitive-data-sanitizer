// Finite CPU probe: 475 kB, three iterations. Node: --max-old-space-size=128.
import { performance } from 'node:perf_hooks';
import { inspect, redact } from '../../src/index.js';
const text = 'ordinary log record\n'.repeat(25000);
for (let i = 0; i < 3; i++) {
  let start = performance.now();
  const found = inspect(text, { secretlint: false });
  console.log(
    JSON.stringify({
      phase: 'inspect',
      milliseconds: performance.now() - start,
    })
  );
  start = performance.now();
  redact(text, found);
  console.log(
    JSON.stringify({ phase: 'render', milliseconds: performance.now() - start })
  );
}
