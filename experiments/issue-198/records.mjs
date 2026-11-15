// Records that keep the parts of one listed name in separate fields (issue 193).
import { compileKnown, inspect, sanitize } from '../../src/index.js';

const known = compileKnown([
  { type: 'PERSON', value: 'Пряжкина Велимира Остаповна' },
  { type: 'PERSON', value: 'Jane Roe' },
]);
const spans = (text, options = {}) =>
  inspect(text, { knownOnly: true, knownPersonal: known, ...options })
    .filter((f) => f.type === 'PERSON')
    .map((f) => text.slice(f.start, f.end));
const show = (label, text, options) =>
  console.log(label.padEnd(18), JSON.stringify(spans(text, options)));

show(
  'xml',
  '<person><last_name>Пряжкина</last_name><first_name>Велимира</first_name></person>'
);
show(
  'xml split',
  '<p><last_name>Пряжкина</last_name></p><p><first_name>Велимира</first_name></p>'
);
show(
  'markdown',
  '| Фамилия | Имя | Отчество |\n|---|---|---|\n| Пряжкина | Велимира | Остаповна |'
);
show('tsv', 'surname\tgiven_name\nПряжкина\tВелимира');
show(
  'sql',
  "INSERT INTO people (id, first_name, last_name) VALUES (1, 'Велимира', 'Пряжкина'), (2, 'Jane', 'Roe');"
);
show('query', '/users?firstName=Jane&lastName=Roe');
show('env', 'FIRST_NAME=Jane\nLAST_NAME=Roe');
show('ini', 'first name = Jane\nlast name = Roe');
show('nested', '{"name": {"first": "Jane", "last": "Roe"}, "id": 1}');
show('two objects', '[{"first_name": "Jane"}, {"last_name": "Roe"}]');
show('yaml list', '- first_name: Jane\n  age: 3\n- last_name: Roe');
show('blank line', 'first_name: Jane\n\nlast_name: Roe');
show('struct nested', '{"name": {"first": "Jane", "last": "Roe"}, "id": 1}', {
  structured: 'json',
});
show('struct two', '[{"first_name": "Jane"}, {"last_name": "Roe"}]', {
  structured: 'json',
});
show(
  'jsonl',
  '{"first_name": "Jane", "last_name": "Roe"}\n{"first_name": "Jane"}',
  { structured: 'jsonl' }
);
show('one part', 'first_name: Jane\nlast_name: Smith');
for (const [text, options] of [
  [
    '{"first_name": "Велимира", "last_name": "Пряжкина", "middle_name": "Остаповна"}',
    {},
  ],
  [
    '{"first_name": "Велимира", "last_name": "Пряжкина", "middle_name": "Остаповна"}',
    { structured: 'json' },
  ],
]) {
  console.log(
    sanitize(text, {
      knownOnly: true,
      knownPersonal: known,
      transformation: { mode: 'placeholder' },
      ...options,
    }).text
  );
  console.log(
    sanitize(text, {
      knownOnly: true,
      knownPersonal: known,
      transformation: { mode: 'fake', key: 'example-key-0123456789abcdef' },
      ...options,
    }).text
  );
}
