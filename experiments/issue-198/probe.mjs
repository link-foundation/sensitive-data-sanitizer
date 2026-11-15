import { compileKnown, inspect } from '../../src/index.js';
const k = (v) => compileKnown(v.map((value) => ({ type: 'PERSON', value })));
const s = (t, kp) =>
  inspect(t, { knownOnly: true, knownPersonal: kp })
    .filter((f) => f.type === 'PERSON')
    .map((f) => [f.rule, t.slice(f.start, f.end)]);
const ty = k(['Тютюнник Евсей']);
for (const t of [
  'подписал Тютюнник',
  'подписал К. Тютюнник',
  'подписал К.Тютюнник',
  '_Пряжкина_ Велимира',
  '*Пряжкина* Велимира',
  '_Пряжкина_',
  'x _Пряжкина Велимира_',
]) {
  console.log(
    JSON.stringify(t),
    JSON.stringify(
      s(t, t.includes('Тют') ? ty : k(['Пряжкина Велимира Остаповна']))
    )
  );
}
