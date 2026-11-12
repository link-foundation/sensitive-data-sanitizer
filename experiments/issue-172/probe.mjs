// Runs probe-one.mjs for many run shapes followed by a two-byte tail, each
// in a child process with a time limit, a few at a time, and prints the
// failures with the first stack frames (issue 172).
// Usage: node probe.mjs [KiB] [modes,comma] [seconds] [parallel] [units JSON]
import { spawn } from 'node:child_process';
import { URL, fileURLToPath } from 'node:url';
const kib = process.argv[2] ?? '6144';
const modes = (process.argv[3] ?? 'credentials,default').split(',');
const seconds = Number(process.argv[4] ?? 180);
const parallel = Number(process.argv[5] ?? 3);
const heads = ['A', 'Ab', 'a1', '1', 'é', 'Я', '中', '😀'];
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
  '=',
  '\\',
  '"',
  "'",
  '%',
  '#',
  '&',
  ';',
  '|',
  '(',
  '. ',
  ' at ',
  '://',
  '\t',
];
const units = process.argv[6]
  ? JSON.parse(process.argv[6])
  : heads.flatMap((head) => separators.map((separator) => head + separator));
const script = fileURLToPath(new URL('probe-one.mjs', import.meta.url));
const jobs = modes.flatMap((mode) => units.map((unit) => [unit, mode]));
const runJob = ([unit, mode]) =>
  new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(
      process.execPath,
      ['--max-old-space-size=3072', script, JSON.stringify(unit), kib, mode],
      {
        env: { ...process.env, SENSITIVE_DATA_SANITIZER_DEBUG: '1' },
      }
    );
    let out = '',
      err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), seconds * 1000);
    child.on('close', () => {
      clearTimeout(timer);
      const ms = Date.now() - started;
      const result =
        out.trim() ||
        (ms >= seconds * 1000 ? 'TIMEOUT' : err.trim().split('\n')[0]);
      const frames = err
        .split('\n')
        .filter((line) => line.includes('/src/'))
        .slice(0, 2)
        .map((line) => line.trim().replace(/.*\/src\//, 'src/'))
        .join(' < ');
      console.log(
        JSON.stringify(unit),
        mode,
        result,
        ms,
        'ms',
        result === 'ok' ? '' : frames
      );
      resolve();
    });
  });
const queue = [...jobs];
await Promise.all(
  Array.from({ length: parallel }, async () => {
    while (queue.length) {
      await runJob(queue.shift());
    }
  })
);
