// Time record detection on large inputs that mention name keys (issue 193).
import { performance } from 'node:perf_hooks';
import { compileKnown, inspect } from '../../src/index.js';

const knownPersonal = compileKnown([
  { type: 'PERSON', value: 'Пряжкина Велимира Остаповна' },
]);
const inputs = {
  prose:
    'At first the last family member said: the given surname is fine. '.repeat(
      15000
    ),
  yaml: 'first_name: Анна\nlast_name: Смирнова\nmiddle_name: Ивановна\n\n'.repeat(
    15000
  ),
  csv: `last_name,first_name\n${'Смирнова,Анна\n'.repeat(60000)}`,
  keys: `${'first name '.repeat(100000)}`,
};
for (const [name, text] of Object.entries(inputs)) {
  const started = performance.now();
  const found = inspect(text, { knownOnly: true, knownPersonal }).length;
  console.log(
    name,
    text.length,
    found,
    `${Math.round(performance.now() - started)} ms`
  );
}
