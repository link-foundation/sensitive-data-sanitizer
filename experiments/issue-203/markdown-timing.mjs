// Issue 201: cost of Markdown record matching (emphasis, list items,
// key/value table rows) on large inputs. Usage:
// node markdown-timing.mjs [path/to/src/index.js] [megabytes]
import { performance } from 'node:perf_hooks';
import { URL, pathToFileURL } from 'node:url';
import path from 'node:path';

const target = process.argv[2]
  ? pathToFileURL(path.resolve(process.argv[2])).href
  : new URL('../../src/index.js', import.meta.url).href;
const size = Number(process.argv[3] ?? 1) * 1_000_000;
const { compileKnown, inspect } = await import(target);

const knownPersonal = compileKnown([
  { type: 'PERSON', value: 'Пряжкина Велимира Остаповна' },
]);
const fill = (unit) => unit.repeat(Math.ceil(size / unit.length));
const inputs = {
  emphasis: fill('**Фамилия:** Сидоренко\n**Имя:** Агния\n\n'),
  list: fill('- **Фамилия:** Сидоренко\n- **Имя:** Агния\n'),
  table: fill('| Фамилия | Сидоренко |\n| Имя | Агния |\n'),
  'list no keys': fill('- пункт списка с текстом\n'),
  'table no keys': fill('| a | b | c |\n'),
};
for (const [name, text] of Object.entries(inputs)) {
  const started = performance.now();
  const found = inspect(text, { knownOnly: true, knownPersonal });
  const ms = Math.round(performance.now() - started);
  console.log(`${name} ${text.length} ${found.length} ${ms} ms`);
}
