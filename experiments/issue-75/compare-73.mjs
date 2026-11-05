// Prints personal-name rows on a shared map, for this tree or another checkout.
// Usage: node experiments/issue-75/compare-73.mjs [path-to-src-index.js]
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const path = resolve(process.argv[2] ?? 'src/index.js');
const { sanitize, restore, createRestoreMap } = await import(
  pathToFileURL(path).href
);

const options = (map) => ({
  profile: 'documents',
  transformation: { mode: 'placeholder', map },
});
const seeded = (seed) => {
  const map = createRestoreMap();
  sanitize(seed, options(map));
  return map;
};
const person = 'Кандидат: Петров Данил.';
const surname = 'Кандидат: Мороз Алексей.';
const rows = [
  [person, 'Опыт: петров день, данил, мария.'],
  [person, 'Навыки: Битрикс петров, Excel.'],
  [person, 'Навыки: Роман петров (CRM), отдел.'],
  [person, 'Опыт.\nСтек: Максим петрова (ПМ), отдел.'],
  [person, 'Отзыв: Алина петрову, отдел.'],
  [person, 'Петров пришёл.'],
  [person, 'Позвонили Петрову Данилу.'],
  [person, 'Д. Петров пришёл.'],
  [person, 'петров данил пришёл.'],
  [surname, 'Сильный мороз. Мороз пришёл.'],
];
for (const [stored, row] of rows) {
  const map = seeded(stored);
  try {
    const { text } = sanitize(row, options(map));
    const exact = restore(text, map) === row;
    console.log(JSON.stringify({ row, text, exact }));
  } catch (error) {
    console.log(JSON.stringify({ row, error: error.code ?? error.message }));
  }
}
