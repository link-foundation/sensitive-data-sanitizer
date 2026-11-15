// What sanitize does with a listed name whose parts sit in separate cells,
// quotes or SQL values (issues 192, 193).
import { compileKnown, sanitize } from '../../src/index.js';

const knownPersonal = compileKnown([
  { type: 'PERSON', value: 'Пряжкина Велимира Остаповна' },
]);
for (const text of [
  'Пряжкина, Велимира Остаповна',
  '| Пряжкина | Велимира | Остаповна |',
  'last_name,first_name\nПряжкина,Велимира',
  '"Пряжкина", "Велимира"',
  "INSERT INTO t (first_name, last_name) VALUES ('Велимира', 'Пряжкина');",
  '**Пряжкина** Велимира',
  'Пряжкина (Велимира)',
]) {
  for (const mode of ['placeholder', 'fake']) {
    const { text: out } = sanitize(text, {
      knownOnly: true,
      knownPersonal,
      transformation: { mode, key: 'example-key-0123456789abcdef' },
    });
    console.log(mode.padEnd(12), JSON.stringify(out));
  }
}
