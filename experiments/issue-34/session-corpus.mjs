import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sanitizeStreamToFile, createSanitizer } from '../../src/index.js';
import { sessionCorpus } from '../../tests/fixtures/issue-34-sessions.mjs';

const directory = await mkdtemp(join(tmpdir(), 'session-publication-'));
try {
  const corpus = await sessionCorpus();
  const verifier = createSanitizer({
    structured: 'jsonl',
    profile: 'publication',
  });
  for (const session of corpus) {
    for (const workers of [1, 4]) {
      const target = join(directory, `${session.name}-${workers}.jsonl`);
      const records = session.records.map(
        (record) => `${JSON.stringify(record)}\n`
      );
      const started = performance.now();
      await sanitizeStreamToFile(records, target, {
        structured: 'jsonl',
        profile: 'publication',
        twoPass: true,
        workers,
        batchBytes: 1,
      });
      const output = await readFile(target, 'utf8');
      assert.equal(
        output.trim().split('\n').map(JSON.parse).length,
        records.length
      );
      assert(!/qazvela|zorveta|zoe@private\.invalid/i.test(output));
      assert(output.includes('compute(936)'));
      assert(output.includes('test_runner'));
      assert(output.includes('standalone validator'));
      assert(output.includes('\\ud83d') && output.includes('\\udc00'));
      assert(
        output.includes(session.name === 'codex' ? 'Rule 399' : 'Guidance 149')
      );
      if (session.name === 'codex') {
        assert(output.includes('The user does not command execution outputs.'));
        assert(output.includes('User-requested deletion'));
      }
      const residuals = await verifier.inspect(output);
      assert.equal(residuals.length, 0);
      console.log(
        JSON.stringify({
          session: session.name,
          workers,
          inputBytes: Buffer.byteLength(records.join('')),
          outputBytes: Buffer.byteLength(output),
          residuals: residuals.length,
          milliseconds: Math.round(performance.now() - started),
        })
      );
    }
  }
  assert.equal((await readdir(directory)).length, corpus.length * 2);
} finally {
  await rm(directory, { recursive: true, force: true });
}
