// Checks the behavior described in docs/API.md for issue 190.
import { inspect, compileKnown } from '../../src/index.js';
import { knownMatcher } from '../../src/compiled-known.js';

const spans = (text, knownPersonal) =>
  inspect(text, { knownOnly: true, knownPersonal }).map((f) =>
    text.slice(f.start, f.end)
  );
const ann = [{ type: 'PERSON', value: 'Ann', identifiers: true }];
console.log('planner', spans('planner annId get_ann AnnBox', ann));
const t = [{ type: 'PERSON', value: 'Тютюнник Евсей', transliterate: true }];
console.log(
  'translit',
  spans('Evsey Tyutyunnik, E. Tyutyunnik, Tyutyunnik E., Tyutyunnika Evseya', t)
);
const p = [{ type: 'PERSON', value: 'Тютюнник Евсей' }];
for (const prefix of ['//', '#', '--', '*', '>', ';', ' * ', '> >']) {
  console.log(JSON.stringify(prefix), spans(`Тютюнник\n${prefix} Евсей`, p));
}
console.log('blank', spans('Тютюнник\n\nЕвсей', p));
const types = compileKnown([
  { type: 'PERSON', value: 'Тютюнник Евсей' },
  { type: 'PHONE', value: '+7 999 123-45-67' },
  { type: 'ID', value: ' 42 ' },
  { type: 'URL', value: 'https://example.org/a' },
  { type: 'EMAIL', value: 'a@example.org' },
  { type: 'DATE', value: '01.02.2003' },
  { type: 'ORGANIZATION', value: 'ООО «Ромашка»' },
  { type: 'PERSON', value: '«Ромашка»' },
]);
console.log('always', knownMatcher(types).always, 'of', types.length);
