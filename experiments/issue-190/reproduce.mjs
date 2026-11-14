// Reproduces #186, #187, #188 and #189 (every name is made up).
import { compileKnown, inspect } from '../../src/index.js';

const person = (...values) =>
  compileKnown(values.map((value) => ({ type: 'PERSON', value })));
const spans = (text, knownPersonal, extra = {}) =>
  inspect(text, { knownOnly: true, knownPersonal, ...extra })
    .filter((f) => f.type === 'PERSON')
    .map((f) => text.slice(f.start, f.end));
const show = (label, value) =>
  console.log(label.padEnd(48), JSON.stringify(value));

console.log('--- #186 identifiers');
show('snake', spans('case tyutyunnik_marketing', person('Tyutyunnik')));
show('camel', spans('const tyutyunnikCase = 1;', person('Tyutyunnik')));
show('SCREAMING', spans('TYUTYUNNIK_CALLS = 1', person('Tyutyunnik')));
show('dot', spans('see tyutyunnik.json', person('Tyutyunnik')));
console.log('--- #186 transliteration');
show('latin', spans('resume of Evsey Tyutyunnik', person('Тютюнник Евсей')));
console.log('--- #187 line breaks');
const k = person('Тютюнник Евсей');
for (const t of [
  'Тютюнника Евсея',
  'Тютюнника\nЕвсея',
  'Тютюнника\n  Евсея',
  '// карточка Тютюнника\n// Евсея',
  '* Тютюнника\n * Евсея',
  'Тютюнника\n\nЕвсея',
]) {
  show(JSON.stringify(t), spans(t, k));
}
console.log('--- #188');
const both = person('Тютюнник Евсей', 'Тютюнник');
show(
  'nested 1',
  inspect('Евсей Тютюнник', { knownOnly: true, knownPersonal: both }).map(
    (f) => [f.start, f.end]
  )
);
show(
  'nested 2',
  inspect('резюме Тютюнника Евсея', {
    knownOnly: true,
    knownPersonal: both,
  }).map((f) => [f.start, f.end])
);
const p = person('Пряжкина Велимира Остаповна');
for (const t of [
  'Велимира Остаповна ответила',
  'Велимира ответила',
  'Пряжкина ответила',
  'Пряжкина В. О.',
  'В. О. Пряжкина',
  'Велимира П. ответила',
]) {
  show(t, spans(t, p));
}
console.log('--- after: per-entry flags');
const flagged = (value, flags) =>
  compileKnown([{ type: 'PERSON', value, ...flags }]);
const id = flagged('Tyutyunnik', { identifiers: true });
for (const t of [
  'case tyutyunnik_marketing',
  'const tyutyunnikCase = 1;',
  'TYUTYUNNIK_CALLS = 1',
  'getTyutyunnikName()',
  'Tyutyunnik',
  'tyutyunniks',
  'xtyutyunnik',
]) {
  show(t, spans(t, id));
}
const tr = flagged('Тютюнник Евсей', { transliterate: true });
for (const t of [
  'resume of Evsey Tyutyunnik',
  'Tiutiunnik Evsei',
  'Yevsey Tjutjunnik',
  'Тютюнника Евсея',
]) {
  show(t, spans(t, tr));
}
const both2 = flagged('Тютюнник Евсей', {
  transliterate: true,
  identifiers: true,
});
for (const t of [
  'tyutyunnik_evsey',
  'evseyTyutyunnik',
  'tyutyunnik_marketing',
]) {
  show(t, spans(t, both2));
}
show(
  'Velimira P.',
  spans(
    'Velimira P. replied',
    flagged('Пряжкина Велимира Остаповна', { transliterate: true })
  )
);
const one = flagged('Тютюнник', { transliterate: true, identifiers: true });
for (const t of [
  'tyutyunnik_marketing',
  'tjutjunnikCase',
  'TIUTIUNNIK_CALLS',
  'тютюнника_звонки',
]) {
  show(t, spans(t, one));
}
