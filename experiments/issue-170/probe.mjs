// Runs probe-one.mjs for many run shapes, each in a child process with a
// time limit, and reports failures and slow shapes (issue 170).
// Usage: node probe.mjs [KiB] [credentials|default] [seconds] [units JSON]
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { URL, fileURLToPath } from 'node:url';
const kib = process.argv[2] ?? '256';
const mode = process.argv[3] ?? 'default';
const seconds = Number(process.argv[4] ?? 60);
const heads = ['a', 'A', 'Ab', '1', 'a1', 'é'];
const separators = [
  '',
  '.',
  '-',
  '_',
  ' ',
  '@',
  '/',
  ':',
  '+',
  ',',
  '\t',
  '=',
  '\\',
  '"',
  "'",
  '%',
  '#',
  '&',
  ';',
  '|',
  '!',
  '(',
  ' at ',
  ' dot ',
  '. ',
  ', ',
  '-a ',
  '://',
];
const units = process.argv[5]
  ? JSON.parse(process.argv[5])
  : heads.flatMap((head) => separators.map((separator) => head + separator));
const script = fileURLToPath(new URL('probe-one.mjs', import.meta.url));
for (const unit of units) {
  const started = performance.now();
  const child = spawnSync(
    process.execPath,
    [script, JSON.stringify(unit), kib, mode],
    { encoding: 'utf8', timeout: seconds * 1000 }
  );
  const ms = Math.round(performance.now() - started);
  const result = child.error
    ? 'TIMEOUT'
    : child.stdout.trim() || child.stderr.trim().split('\n')[0];
  console.log(JSON.stringify(unit), kib, mode, result, ms, 'ms');
}
