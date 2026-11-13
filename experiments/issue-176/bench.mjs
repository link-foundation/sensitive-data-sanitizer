// Times sanitizeFileToFile with and without a netrc-looking trigger line (#176).
import { performance } from 'node:perf_hooks';
import { writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sanitizeFileToFile } from '../../src/index.js';
const line = (i) =>
  `2026-11-12T00:00:00.000Z INFO ordinary log line ${i} some text here and more text to pad the line\n`;
const max = Number(process.argv[2] ?? 16000);
for (let n = 2000; n <= max; n *= 2) {
  for (const trigger of [
    '',
    'default = ["macro"]\n',
    'machine learning is fun\n',
  ]) {
    const file = join(tmpdir(), `bench-176-${n}.log`);
    await writeFile(
      file,
      trigger + Array.from({ length: n }, (_, i) => line(i)).join('')
    );
    const t = performance.now();
    await sanitizeFileToFile(file, `${file}.out`, {
      replace: true,
      credentialsOnly: true,
    });
    console.log(
      `${JSON.stringify(trigger.trim() || 'plain')} n=${n} ${(performance.now() - t).toFixed(0)}ms`
    );
    await rm(file);
    await rm(`${file}.out`);
  }
}
