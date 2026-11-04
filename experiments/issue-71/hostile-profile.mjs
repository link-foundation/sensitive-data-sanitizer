// Times the hostile test payload at growing sizes, with and without documents.
// Run from the repository root: node experiments/issue-71/hostile-profile.mjs
import { performance } from 'node:perf_hooks';
import { inspect, sanitize } from '../../src/index.js';

const line = `${'слово '.repeat(2000)}, ${'Имя '.repeat(2000)}(2019`;
const time = (run) => {
  const start = performance.now();
  run();
  return `${(performance.now() - start).toFixed(0)}ms`;
};
const placeholder = {
  profile: 'documents',
  transformation: { mode: 'placeholder', format: '[{TYPE}_{n}]', map: false },
};
for (const lines of [5, 10, 20, 40]) {
  const text = `${line}\n`.repeat(lines);
  console.log(
    `lines=${lines} length=${text.length}`,
    `inspect-default=${time(() => inspect(text))}`,
    `inspect-documents=${time(() => inspect(text, { profile: 'documents' }))}`,
    `sanitize-documents=${time(() => sanitize(text, placeholder))}`
  );
}
