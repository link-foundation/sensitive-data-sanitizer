// Prints the work-experience table rows and hostile-timing for the experience rule.
// Run from the repository root: node experiments/issue-75/lines-74.mjs
import { performance } from 'node:perf_hooks';
import { sanitize, inspect } from '../../src/index.js';

const D = (t) =>
  sanitize(t, {
    profile: 'documents',
    transformation: { mode: 'placeholder', format: '[{TYPE}_{n}]', map: false },
  }).text;
for (const row of [
  'Менеджер по продажам, Северная торговая компания (2019-05-01 — 2021-03-01)',
  'Опыт: Менеджер по продажам, Северная торговая компания (2019-05-01 — 2021-03-01)',
  'Опыт: Менеджер по продажам, Ромашка (2019-05-01 — 2021-03-01)',
  'Работа: Руководитель отдела продаж, Северный ветер (2018-01-01 — 2020-12-01)',
  '- Опыт: Менеджер, Ромашка (2018-01-01 — 2020-12-01)',
  'Должность: Менеджер | Опыт: Аналитик, Ромашка (2018-01-01 — 2020-12-01)',
  'Опыт - Менеджер, Ромашка (2018-01-01 — 2020-12-01)',
  'Менеджер, Ромашка (2018-01 – по н.в.)',
  '• Менеджер, Ромашка (2018-01-01 — 2020-12-01)',
  'Итог: Встреча, понедельник (2019-05-01 — 2021-03-01) перенесена.',
]) {
  console.log(`${row}\n  => ${D(row)}`);
}
const shapes = {
  words: (n) => 'Менеджер, '.repeat(n),
  capitalized: (n) => 'Менеджер Компании '.repeat(n),
  noRange: (n) => `Менеджер, ${'Ромашка '.repeat(n)}(2019-05 –`,
  labels: (n) => 'Опыт: '.repeat(n),
  pipes: (n) => 'Опыт | '.repeat(n),
  dashes: (n) => 'Опыт - '.repeat(n),
  labelledNoRange: (n) => `Опыт: Менеджер, ${'Ромашка '.repeat(n)}(2019-05 –`,
  dates: (n) => 'Менеджер, Ромашка (2019-05 '.repeat(n),
};
for (const [name, build] of Object.entries(shapes)) {
  for (const n of [2000, 4000, 8000]) {
    const text = build(n);
    const start = performance.now();
    inspect(text, { profile: 'documents' });
    console.log(
      `${name} n=${n} length=${text.length} ${(performance.now() - start).toFixed(0)}ms`
    );
  }
}
