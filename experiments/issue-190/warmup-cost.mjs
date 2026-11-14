import { performance } from 'node:perf_hooks';
// #189: per-entry lazy RegExp compilation cost of the first inspect() calls.
// Usage: node experiments/issue-190/warmup-cost.mjs [sizes...]
import { compileKnown, inspect } from '../../src/index.js';

const syl = ['ка', 'ло', 'ми', 'ре', 'ту', 'на', 'во', 'си', 'за', 'бе'];
let seed = 7;
const rnd = () =>
  (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const word = (n) => {
  let w = '';
  for (let i = 0; i < n; i++) {
    w += syl[Math.floor(rnd() * syl.length)];
  }
  return w[0].toUpperCase() + w.slice(1);
};
const sizes = process.argv.slice(2).map(Number);
for (const n of sizes.length ? sizes : [100, 1000, 2500]) {
  let t = performance.now();
  const known = compileKnown(
    Array.from({ length: n }, () => ({
      type: 'PERSON',
      value: `${word(3)}ов ${word(2)}`,
    }))
  );
  const compileMs = performance.now() - t;
  const calls = [];
  for (let i = 0; i < 8; i++) {
    t = performance.now();
    inspect(`текст номер ${i} без имен`, {
      knownOnly: true,
      knownPersonal: known,
    });
    calls.push(Math.round(performance.now() - t));
  }
  console.log(
    n,
    'compileKnown',
    Math.round(compileMs),
    'ms; inspect calls',
    calls.join(' '),
    'ms'
  );
}
