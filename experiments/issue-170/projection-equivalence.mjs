// Issue 170: fuzzes projectText against a copy of the module from another
// source tree (the code before the fix), then projects 10 MiB escape runs.
// Usage: node experiments/issue-170/projection-equivalence.mjs <old src> [runs]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectText } from '../../src/projection.js';

const before = await import(
  pathToFileURL(path.resolve(process.argv[2], 'projection.js')).href
);
const runs = Number(process.argv[3] ?? 100000);
const pieces = ['U+', '\\', '0041', '4', 'f', 'a', ' ', 'x', 'U', '+', '\\u'];
let random = 170;
const next = () => {
  random = (random * 1103515245 + 12345) % 2147483648;
  return random / 2147483648;
};
const shape = (result) =>
  JSON.stringify([
    result.text,
    result.changed,
    result.starts && [...result.starts.slice(0, result.text.length)],
    result.ends && [...result.ends.slice(0, result.text.length)],
  ]);
let differences = 0;
let changed = 0;
for (let i = 0; i < runs; i++) {
  let text = '';
  const count = Math.floor(next() * 24);
  for (let j = 0; j < count; j++) {
    text += pieces[Math.floor(next() * pieces.length)];
  }
  const want = shape(before.projectText(text));
  changed += before.projectText(text).changed ? 1 : 0;
  if (want !== shape(projectText(text))) {
    differences++;
    if (differences <= 5) {
      console.log(JSON.stringify(text), want, shape(projectText(text)));
    }
  }
}
console.log(`runs=${runs} changed=${changed} differences=${differences}`);
for (const unit of ['U+0041 ', 'U+0041', '\\41 ']) {
  const text = unit.repeat(Math.ceil((10 * 1024 * 1024) / unit.length));
  try {
    console.log(JSON.stringify(unit), projectText(text).text.length);
  } catch (error) {
    console.log(JSON.stringify(unit), error.message);
  }
}
