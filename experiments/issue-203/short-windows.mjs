// Issue 202: knownOnly inspect() on thousands of ~1 KB windows.
// Usage: node short-windows.mjs [path/to/src/index.js] [rounds]
import { performance } from 'node:perf_hooks';
import { URL, pathToFileURL } from 'node:url';
import path from 'node:path';

const target = process.argv[2]
  ? pathToFileURL(path.resolve(process.argv[2])).href
  : new URL('../../src/index.js', import.meta.url).href;
const rounds = Number(process.argv[3] ?? 3);
const { compileKnown, inspect } = await import(target);

const known = compileKnown(
  ['Пряжкина Велимира Остаповна', 'Тютюнник Евсей', 'Ольховецкий'].map(
    (value) => ({ type: 'PERSON', value })
  ),
  { identifiers: true, transliterate: true, warm: true }
);
const prose =
  'Кандидат прошёл интервью, рекрутер Пряжкина отметила опыт в Go и Kubernetes; ' +
  '| 12 | Велимира | 54 | "ok" | см. `case_one`, &amp; https://example.test/a?b=1 ' +
  '**итог:** нужен ещё один созвон, оценка 4/5 — без замечаний.\n';
const windows = Array.from({ length: 4000 }, (_, i) =>
  (prose.repeat(5) + i).slice(i % 50)
);
let findings = 0;
for (let round = 0; round < rounds; round += 1) {
  const started = performance.now();
  for (const w of windows) {
    findings += inspect(w, { knownOnly: true, knownPersonal: known }).length;
  }
  console.log(`round ${round}: ${Math.round(performance.now() - started)} ms`);
}
console.log(`findings: ${findings}`);
