// Traces which rule produces each finding for the #73 shared-map rows.
// Run from the repository root: node experiments/issue-75/trace-73.mjs
import { sanitize, inspect, createRestoreMap } from '../../src/index.js';

const seed = 'Кандидат: Петров Данил.';
const rows = [
  'Опыт: петров день, данил, мария.',
  'Навыки: Битрикс петров, Excel.',
  'Навыки: Роман петров (CRM), отдел.',
  'Опыт.\nСтек: Максим петрова (ПМ), отдел.',
  'Отзыв: Алина петрову, отдел.',
  'Сильный мороз. Петров пришёл.',
  'Роман Петров пришёл.',
  'Позвонили Петрову Данилу.',
];
for (const row of rows) {
  const map = createRestoreMap();
  const P = {
    profile: 'documents',
    transformation: { mode: 'placeholder', map },
  };
  sanitize(seed, P);
  let out;
  try {
    out = sanitize(row, P).text;
  } catch (e) {
    out = `THROW ${e.code}`;
  }
  const map2 = createRestoreMap();
  const P2 = {
    profile: 'documents',
    transformation: { mode: 'placeholder', map: map2 },
  };
  sanitize(seed, P2);
  const findings = inspect(row, P2).findings?.map(
    (f) => `${f.rule}:${row.slice(f.start, f.end)}`
  );
  console.log(
    JSON.stringify({
      row,
      out,
      findings,
      values: map.entries.map((e) => e.values),
    })
  );
}
