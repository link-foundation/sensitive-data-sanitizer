// Measures whether detection of hostile CV-like lines scales linearly.
// Run from the repository root: node experiments/issue-71/hostile-timing.mjs
import { performance } from 'node:perf_hooks';
import { inspect } from '../../src/index.js';

const shapes = {
  words: (n) => 'Менеджер, '.repeat(n),
  capitalized: (n) => 'Менеджер Компании '.repeat(n),
  noRange: (n) => `Менеджер, ${'Ромашка '.repeat(n)}(2019-05 –`,
  dates: (n) => 'Менеджер, Ромашка (2019-05 '.repeat(n),
};
for (const [name, build] of Object.entries(shapes)) {
  for (const n of [2000, 4000, 8000]) {
    const text = build(n);
    const start = performance.now();
    inspect(text, { profile: 'documents' });
    const documents = performance.now() - start;
    const base = performance.now();
    inspect(text);
    const plain = performance.now() - base;
    console.log(
      `${name} n=${n} length=${text.length} documents=${documents.toFixed(0)}ms default=${plain.toFixed(0)}ms`
    );
  }
}
