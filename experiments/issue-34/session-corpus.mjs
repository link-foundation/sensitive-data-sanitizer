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
      assert(!/84812345678|028 12 345 678|fixture-private/.test(output));
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
        const parsed = output.trim().split('\n').map(JSON.parse);
        assert.equal(
          parsed.find((record) => record.type === 'turn_context').payload
            .collaboration_mode.settings.developer_instructions,
          null
        );
        assert.equal(
          parsed.find((record) => record.payload?.rate_limits).payload
            .rate_limits.limit_name,
          null
        );
        assert(output.includes('codec::'));
        assert(output.includes('nom::{'));
        assert(output.includes('{"text":"sig:\' "}'));
        assert(output.includes('request-log write lock'));
        assert(!output.includes('private_key:9'));
      } else {
        assert(output.includes('name:Claude'));
        assert(output.includes('Claude...'));
        assert(output.includes('Authorization:'));
        assert(output.includes('token for ES.\\nes u'));
        assert(output.includes('SIG for\\n:sig is d'));
      }
      assert(output.includes('Elon Musk'));
      assert(output.includes('state:.[0].status'));
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
