// Reproduces issue 206: a letter that starts a longer token (`F2C`, `Ф2`,
// `Ф-2`) is taken for the surname initial after a listed given name.
// Usage: node experiments/issue-206/token-initial.mjs
import { compileKnown, inspect } from '../../src/index.js';

const known = compileKnown([{ type: 'PERSON', value: 'Фомичёв Марк' }], {
  identifiers: true,
  transliterate: true,
});
for (const t of [
  'if I mark F2C partial',
  'Марк Ф2 и Марк Ф-2 ушли',
  'Марк Ф. ответил',
]) {
  const found = inspect(t, { knownOnly: true, knownPersonal: known }).map((f) =>
    t.slice(f.start, f.end)
  );
  console.log(JSON.stringify(t), JSON.stringify(found));
}
