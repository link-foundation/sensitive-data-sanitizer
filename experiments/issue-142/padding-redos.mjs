// Times sanitize on wrapped base64-like runs followed by long `=` runs
// (CodeQL js/polynomial-redos on the wrapped-binary padding trim). Through
// sanitize both padding trims scale linearly, because the candidate pattern
// keeps long `=` runs out of isWrappedBinary.
import { performance } from 'node:perf_hooks';
import { sanitize } from '../../src/index.js';

const line = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2';
for (const n of [5000, 20000, 40000]) {
  for (const [name, text] of [
    ['mid', `${line}\n${line}\n${'='.repeat(n)}x`],
    ['lines', `${line}\n${line}\n${'='.repeat(n)}\nx`],
    ['tail', `${line}\n${line}\n${'='.repeat(n)}`],
  ]) {
    const start = performance.now();
    sanitize(text);
    console.log(name, n, `${(performance.now() - start).toFixed(1)} ms`);
  }
}
