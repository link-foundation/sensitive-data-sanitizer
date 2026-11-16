// Reproduces issue 205: listed given names of three letters or fewer and
// `Любовь` are found only in the nominative case.
// Usage: node experiments/issue-205/short-given-names.mjs
import { compileKnown, inspect } from '../../src/index.js';

const known = compileKnown(
  [
    'Сурдин Ян',
    'Гусев Ким',
    'Шмелёва Ева',
    'Ковыльская Ия',
    'Пыжиков Лев',
    'Рябинцева Любовь',
  ].map((value) => ({ type: 'PERSON', value })),
  { identifiers: true, transliterate: true }
);
for (const t of [
  'Письмо Сурдину Яну',
  'с Сурдиным Яном',
  'Гусеву Киму',
  'с Гусевым Кимом',
  'Шмелёвой Еве',
  'Шмелёву Еву',
  'Ковыльской Ие',
  'Ковыльскую Ию',
  'Пыжикову Льву',
  'Рябинцевой Любви',
  'Ян С. ответил',
  'Яну С. ответили',
  'Еве Ш.',
  'Льву П.',
  'Любви Р.',
]) {
  const found = inspect(t, { knownOnly: true, knownPersonal: known }).map((f) =>
    t.slice(f.start, f.end)
  );
  console.log(JSON.stringify(t), JSON.stringify(found));
}
