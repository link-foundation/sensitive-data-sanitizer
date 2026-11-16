// Issue 201: Markdown emphasis in record spans, list-item fields and
// key/value table rows. Every name is made up.
import { compileKnown, inspect, sanitize } from '../../src/index.js';

const known = compileKnown([
  { type: 'PERSON', value: 'Пряжкина Велимира Остаповна' },
]);
const spans = (text) =>
  inspect(text, { knownOnly: true, knownPersonal: known })
    .filter((f) => f.type === 'PERSON')
    .map((f) => text.slice(f.start, f.end));

for (const text of [
  '**Фамилия:** Пряжкина\n**Имя:** Велимира',
  'Фамилия: **Пряжкина**\nИмя: **Велимира**',
  '- **Фамилия:** Пряжкина\n- **Имя:** Велимира',
  '- last_name: Пряжкина\n- first_name: Велимира',
  '| Фамилия | Пряжкина |\n| Имя | Велимира |',
  '| Поле | Значение |\n| --- | --- |\n| Фамилия | Пряжкина |\n| Имя | Велимира |',
  'Фамилия: Пряжкина\nИмя: Велимира',
]) {
  const out = await sanitize(text, { knownOnly: true, knownPersonal: known });
  console.log(JSON.stringify(text), spans(text), JSON.stringify(out.text));
}
