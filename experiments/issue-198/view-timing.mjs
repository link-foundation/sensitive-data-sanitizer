// Time the decoded known-value view on about 1 MB of text that triggers it:
// mixed Cyrillic and Latin prose, percent-encoded URLs, HTML references.
import { performance } from 'node:perf_hooks';
import { compileKnown, inspect } from '../../src/index.js';

const knownPersonal = compileKnown([
  { type: 'PERSON', value: 'Пряжкина Велимира Остаповна' },
]);
const repeat = (line) => line.repeat(Math.ceil(1_000_000 / line.length));
const inputs = {
  mixed: repeat('Отчёт по проекту release v2.3 готов, see PR 42 и CI logs. '),
  percent: repeat(
    `GET /search?q=${encodeURIComponent('отчёт по проекту')}&page=2 200\n`
  ),
  html: repeat(
    '<p>&#1054;&#1090;&#1095;&#1105;&#1090;&nbsp;готов&hellip;</p>\n'
  ),
};
for (const [name, text] of Object.entries(inputs)) {
  for (const knownOnly of [true, false]) {
    const started = performance.now();
    const found = inspect(text, { knownPersonal, knownOnly }).length;
    console.log(
      `${name} knownOnly=${knownOnly} ${(text.length / 1e6).toFixed(2)} MB: ${Math.round(performance.now() - started)} ms, ${found} findings`
    );
  }
}
