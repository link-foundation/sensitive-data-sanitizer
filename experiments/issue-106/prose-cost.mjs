import { performance } from 'node:perf_hooks';
// Finite probe: bounded-probe.js supplies a 128 MiB heap, 1 MiB stack and a
// two-second matching deadline. Run directly for measurements only.
import { detectProperNames } from '../../src/proper-names.js';
const options = { properNames: 'capitalized' };
const sizes = [50000, 100000, 200000];
const samples = [];
detectProperNames('текст Acme', () => {}, options);
process.send?.('ready');
const start = performance.now();
for (const size of sizes) {
  const before = performance.now();
  for (const token of [
    'a'.repeat(size),
    'a.'.repeat(size / 2),
    `a${'.'.repeat(size)}a`,
    'A-'.repeat(size / 2),
    `«${'a'.repeat(size)}`,
    `a${'/'.repeat(size)}a`,
  ]) {
    detectProperNames(`текст ${token}`, () => {}, options);
  }
  samples.push({ size, milliseconds: performance.now() - before });
}
console.log(
  JSON.stringify({
    maxBytes: sizes.at(-1),
    milliseconds: performance.now() - start,
    samples,
  })
);
