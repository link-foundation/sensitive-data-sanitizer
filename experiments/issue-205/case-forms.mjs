// Checks every case form of the short given names from issue 205, both name
// orders, the surname initial, and texts that must stay unmatched.
// Usage: node experiments/issue-205/case-forms.mjs
import { compileKnown, inspect } from '../../src/index.js';

const listed = [
  ['Сурдин Ян', 'Сурдин', ['Ян', 'Яна', 'Яну', 'Яном', 'Яне']],
  ['Гусев Ким', 'Гусев', ['Ким', 'Кима', 'Киму', 'Кимом', 'Киме']],
  ['Шмелёва Ева', 'Шмелёва', ['Ева', 'Евы', 'Еве', 'Еву', 'Евой']],
  ['Ковыльская Ия', 'Ковыльская', ['Ия', 'Ии', 'Ию', 'Ией']],
  ['Рябинцева Любовь', 'Рябинцева', ['Любовь', 'Любви', 'Любови', 'Любовью']],
  ['Пыжиков Лев', 'Пыжиков', ['Лев', 'Льва', 'Льву', 'Львом', 'Льве']],
  ['Ноев Ной', 'Ноев', ['Ной', 'Ноя', 'Ною', 'Ноем', 'Ное']],
  ['Ли Ян', 'Ли', ['Ян']],
];
const find = (text, known) =>
  inspect(text, { knownOnly: true, knownPersonal: known }).map((f) =>
    text.slice(f.start, f.end)
  );
let failures = 0;
const expect = (text, known, wanted) => {
  const found = find(text, known);
  const ok = JSON.stringify(found) === JSON.stringify(wanted);
  failures += ok ? 0 : 1;
  console.log(
    ok ? 'ok  ' : 'FAIL',
    JSON.stringify(text),
    JSON.stringify(found)
  );
};
for (const [value, surname, forms] of listed) {
  for (const flags of [{}, { identifiers: true, transliterate: true }]) {
    const known = compileKnown([{ type: 'PERSON', value }], flags);
    for (const form of forms) {
      expect(`${surname} ${form}`, known, [`${surname} ${form}`]);
      expect(`${form} ${surname}`, known, [`${form} ${surname}`]);
    }
    const initial = surname[0];
    if (value !== 'Ли Ян') {
      for (const form of forms) {
        expect(`${form} ${initial}. ответил`, known, [`${form} ${initial}.`]);
      }
    }
    // Short given names alone, or beside another word, stay text.
    for (const form of forms.slice(1)) {
      expect(`${form} пришёл`, known, []);
    }
  }
}
// Single-word values do not decline short words.
const single = compileKnown([{ type: 'PERSON', value: 'Ян' }]);
expect('Яну написали', single, []);
expect('Ян написал', single, ['Ян']);
console.log(failures ? `${failures} failures` : 'all ok');
process.exitCode = failures ? 1 : 0;
