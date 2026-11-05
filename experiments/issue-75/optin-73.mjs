// #73 third expectation: when a bare part is stored as its own value, the span
// takes the adjacent given name or patronymic of the same mention.
import { sanitize, restore, createRestoreMap } from '../../src/index.js';
const P = (map) => ({
  profile: 'documents',
  transformation: { mode: 'placeholder', map },
});
const own = () => {
  const map = createRestoreMap();
  sanitize('Мороз. Петров Данил.', {
    knownOnly: true,
    knownPersonal: [
      { type: 'PERSON', value: 'Мороз' },
      { type: 'PERSON', value: 'Петров Данил' },
      { type: 'PERSON', value: 'Петров' },
    ],
    transformation: { mode: 'placeholder', map },
  });
  return JSON.parse(JSON.stringify(map));
};
console.log(JSON.stringify(own().entries));
for (const row of [
  'Мороз пришёл.',
  'Сильный мороз.',
  'Алина Мороз пришла.',
  'Алине Мороз звонили.',
  'Роман Мороз пришёл.',
  'Мороз Алина Игоревна пришла.',
  'Алина Игоревна Мороз пришла.',
  'Мороз Сергеевич пришёл.',
  'Петров пришёл.',
  'петров пришёл.',
  'Данил Петров пришёл.',
  'Алина Петрову звонила.',
  'Отзыв: Максим Петрова (ПМ), отдел.',
  'Москва Петров.',
  'Отдел Мороз.',
]) {
  const map = own();
  try {
    const { text } = sanitize(row, P(map));
    console.log(
      row.padEnd(38),
      text.padEnd(30),
      restore(text, map) === row,
      map.entries.length
    );
  } catch (e) {
    console.log(row.padEnd(38), 'THROWS', e.code);
  }
}
const known = (value, text) =>
  sanitize(text, {
    knownOnly: true,
    knownPersonal: [{ type: 'PERSON', value }],
    transformation: { mode: 'placeholder', map: createRestoreMap() },
  }).text;
console.log(known('Петров', 'Алина Петрову звонила. Петров.'));
console.log(
  known('Данил Мороз', 'Сильный мороз. Мороз пришёл. Данил Мороз пришёл.')
);
