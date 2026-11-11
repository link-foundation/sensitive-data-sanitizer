// Finite comparison of equally sized publication fixtures, one worker at a time.
// Run with node --max-old-space-size=512.
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { sanitizeFileBounded } from '../../src/index.js';

const directory = await mkdtemp(join(tmpdir(), 'stream-record-shape-'));
try {
  for (const [recordBytes, records] of [
    [1024, 11000],
    [65536, 172],
  ]) {
    const input = join(directory, 'input');
    const output = join(directory, 'output');
    await writeFile(
      input,
      `${`ordinary ${' '.repeat(recordBytes - 10)}\n`.repeat(records)}password: secret\n`
    );
    const started = performance.now();
    const result = await sanitizeFileBounded(input, output, {
      secretlint: false,
      batchBytes: 512 * 1024,
      maxTotalBytes: 12 * 1024 * 1024,
      workerHeapMb: 128,
      workerTimeoutMs: 25000,
    });
    assert(result.inputBytes > 10 * 1024 * 1024);
    assert((await readFile(output, 'utf8')).endsWith('password: [REDACTED]\n'));
    console.log(
      JSON.stringify({
        recordBytes,
        records,
        ...result,
        ms: performance.now() - started,
      })
    );
    await rm(output);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
