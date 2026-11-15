// Times known-name matching on long runs of separator marks after a listed
// surname. The gap has two quantifiers split by the line break, so the time
// must grow linearly with the run length.
import { performance } from 'node:perf_hooks';
import { compileKnown, inspect } from '../../src/index.js';

const known = compileKnown([
  { type: 'PERSON', value: 'Пряжкина Велимира Остаповна' },
  { type: 'PERSON', value: 'Тютюнник Евсей' },
]);
for (const unit of [' ', ', ', '| ', '*', '"«', ' \n', ' .']) {
  for (const n of [10000, 40000]) {
    const text = `Пряжкина${unit.repeat(n)}x Тютюнник${unit.repeat(n)}Е`;
    const start = performance.now();
    inspect(text, { knownOnly: true, knownPersonal: known });
    console.log(
      JSON.stringify(unit),
      n,
      `${(performance.now() - start).toFixed(1)} ms`
    );
  }
}
