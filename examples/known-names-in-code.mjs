// Finds a listed person in source code, Latin spellings and wrapped comments,
// then replaces every occurrence with one restorable placeholder.
import {
  compileKnown,
  inspect,
  restore,
  sanitize,
} from '@link-foundation/sensitive-data-sanitizer';

// The options object sets defaults for every entry; `warm: true` compiles
// every matching expression up front. The surname is listed on its own so
// that it also matches without the given name.
const knownPersonal = compileKnown(
  [
    { type: 'PERSON', value: 'Тютюнник Евсей' },
    { type: 'PERSON', value: 'Тютюнник' },
  ],
  { identifiers: true, transliterate: true, warm: true }
);

const text = `// Reviewed by Тютюнник
// Евсей on Monday.
const tyutyunnikId = getTyutyunnikName();
const EVSEY_TYUTYUNNIK_TOKEN = load();
// Author: Evsey Tyutyunnik (Tiutiunnik E.)`;

for (const finding of inspect(text, { knownOnly: true, knownPersonal })) {
  console.log(JSON.stringify(text.slice(finding.start, finding.end)));
}
// "Тютюнник\n// Евсей"
// "tyutyunnik"
// "Tyutyunnik"
// "EVSEY_TYUTYUNNIK"
// "Evsey Tyutyunnik"
// "Tiutiunnik E."

const result = sanitize(text, {
  knownOnly: true,
  knownPersonal,
  transformation: { mode: 'placeholder' },
});
console.log(result.text);
// // Reviewed by Person-1 on Monday.
// const Person-1Id = getPerson-1Name();
// const Person-1_TOKEN = load();
// // Author: Person-1 (Person-1)
console.log(restore(result.text, result.map) === text);
// true
