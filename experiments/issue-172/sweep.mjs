import { performance } from 'node:perf_hooks';
// Runs find-regex.mjs over many run shapes, three child processes at a time,
// and prints every expression that overflowed (issue 172).
// Usage: node sweep.mjs [KiB] [credentials|default] [parallel]
import { execFile } from 'node:child_process';
import { URL, fileURLToPath } from 'node:url';
const [kib = '6144', mode = 'default', parallel = '3'] = process.argv.slice(2);
const finder = fileURLToPath(new URL('./find-regex.mjs', import.meta.url));
const shapes = [
  ['A', ''],
  ['a', 'A'],
  ['a', ''],
  ['Ab', ''],
  ['1', ''],
  ['a.', ''],
  ['a-', ''],
  ['a_', ''],
  ['a/', ''],
  ['a+', ''],
  ['a=', ''],
  ['%', ''],
  ['é', ''],
  ['Я', ''],
  ['я', 'Я'],
  ['中', ''],
  ['😀', ''],
  ['𝐀', ''],
  ['a\\', ''],
  ['"', ''],
  ['a:', ''],
  ['a@', ''],
  ['a ', ''],
  ['a\t', ''],
  ['ab, ', ''],
  ['…', ''],
  ['—', ''],
  ['x', 'https://'],
  ['A', '"'],
];
const queue = [...shapes];
async function worker() {
  for (let shape; (shape = queue.shift());) {
    const [unit, head] = shape;
    const started = performance.now();
    const output = await new Promise((resolve) =>
      execFile(
        process.execPath,
        [finder, JSON.stringify(unit), kib, mode, JSON.stringify(head)],
        {
          env: { ...process.env, KEEP_GOING: '1' },
          timeout: 900_000,
          maxBuffer: 1 << 24,
        },
        (error, stdout, stderr) =>
          resolve(`${stdout}${stderr}${error && !stdout ? error.message : ''}`)
      )
    );
    const lines = output
      .trim()
      .split('\n')
      .map((line) => line.slice(0, 300));
    console.log(
      `== ${JSON.stringify(unit)} head=${JSON.stringify(head)} ${Math.round(performance.now() - started)} ms`
    );
    for (const line of lines) {
      console.log(`   ${line}`);
    }
  }
}
await Promise.all(Array.from({ length: Number(parallel) }, worker));
