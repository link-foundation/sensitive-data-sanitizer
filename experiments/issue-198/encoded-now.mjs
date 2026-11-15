// What inspect and sanitize report today for the encoded forms of issue 197.
import { compileKnown, inspect, sanitize } from '../../src/index.js';

const pr = compileKnown([
  { type: 'PERSON', value: 'Пряжкина Велимира Остаповна' },
]);
for (const text of [
  encodeURIComponent('Пряжкина Велимира'),
  '&#1055;&#1088;&#1103;&#1078;&#1082;&#1080;&#1085;&#1072; Велимира',
  'Пряжкина&nbsp;Велимира',
  'Пряжкина\\nВелимира',
]) {
  const options = { knownOnly: true, knownPersonal: pr };
  console.log(
    JSON.stringify(
      inspect(text, options).map((f) => [
        f.type,
        f.rule,
        text.slice(f.start, f.end),
      ])
    )
  );
  console.log(
    sanitize(text, { ...options, transformation: { mode: 'placeholder' } }).text
  );
}
