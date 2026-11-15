// Placeholder round trip for names split over separators and record fields.
import {
  compileKnown,
  createRestoreMap,
  restore,
  sanitize,
} from '../../src/index.js';

const knownPersonal = compileKnown([
  { type: 'PERSON', value: 'Пряжкина Велимира Остаповна' },
]);
for (const text of [
  '| Пряжкина | Велимира | Остаповна |',
  '"Пряжкина", "Велимира"',
  '{"first_name": "Велимира", "last_name": "Пряжкина"}',
  'Пряжкина Велимира',
]) {
  const map = createRestoreMap();
  const { text: output } = sanitize(text, {
    knownOnly: true,
    knownPersonal,
    transformation: { mode: 'placeholder', map },
  });
  const back = restore(output, map);
  console.log(
    back === text ? 'ok  ' : 'DIFF',
    JSON.stringify(output),
    JSON.stringify(back)
  );
}
