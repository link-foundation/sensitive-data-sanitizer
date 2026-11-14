// Measures inspect() on a long text with a large known list, plain and with
// compileKnown(list, { warm: true }). Usage: node long-text-cost.mjs [entries]
import { performance } from 'node:perf_hooks';
import { compileKnown, inspect } from '../../src/index.js';

const n = Number(process.argv[2] ?? 2500);
const syl = ['ка', 'ло', 'ми', 'ре', 'ту', 'на', 'во', 'си', 'за', 'бе'];
let seed = 7;
const rnd = () =>
  (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const word = (k) => {
  let w = '';
  for (let i = 0; i < k; i++) {
    w += syl[Math.floor(rnd() * syl.length)];
  }
  return w[0].toUpperCase() + w.slice(1);
};
const list = Array.from({ length: n }, () => ({
  type: 'PERSON',
  value: `${word(3)}ов ${word(2)}`,
}));
const prose = Array.from({ length: 20000 }, () => word(2).toLowerCase());
for (let i = 0; i < 50; i++) {
  prose[i * 400] = list[i * 7].value;
}
const text = prose.join(' ');
for (const warm of [false, true]) {
  let t = performance.now();
  const known = compileKnown(list, { warm });
  const compileMs = performance.now() - t;
  const calls = [];
  let found = 0;
  for (let i = 0; i < 4; i++) {
    t = performance.now();
    found = inspect(text, { knownOnly: true, knownPersonal: known }).length;
    calls.push(Math.round(performance.now() - t));
  }
  console.log(
    `warm=${warm} entries=${n} text=${text.length} compileKnown ${Math.round(compileMs)} ms;`,
    `inspect ${calls.join(' ')} ms; findings ${found}`
  );
}
