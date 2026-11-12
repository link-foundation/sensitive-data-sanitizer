// Issue 170: checks decodedRuns on long percent-encoded and wrapped runs.
// Usage: node experiments/issue-170/encoded-runs.mjs [MiB] [src dir]
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const mib = Number(process.argv[2] ?? 10);
const dir = path.resolve(process.argv[3] ?? 'src');
const { decodedRuns } = await import(
  pathToFileURL(path.join(dir, 'encoded.js')).href
);
const size = mib * 1024 * 1024;
const shapes = {
  'Ab%': 'Ab%',
  '%41': '%41',
  'a%41': 'a%41',
  wrapped: `\n${'A'.repeat(64)}`,
  'short lines': '\nAAAA',
};
for (const [name, unit] of Object.entries(shapes)) {
  const head =
    name.includes('lines') || name === 'wrapped' ? 'A'.repeat(64) : '';
  const text = head + unit.repeat(Math.ceil(size / unit.length));
  const started = performance.now();
  let result;
  try {
    let count = 0;
    let limited = 0;
    for (const run of decodedRuns(text)) {
      count++;
      limited += run.limited ? 1 : 0;
    }
    result = `ok runs=${count} limited=${limited}`;
  } catch (error) {
    result = `${error.name}: ${error.message}`;
  }
  console.log(name, result, `${Math.round(performance.now() - started)} ms`);
}
