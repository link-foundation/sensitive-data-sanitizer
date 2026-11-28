import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { describe, it } from 'test-anywhere';
import { sanitizeFileBounded, sanitizeStream } from '../src/index.js';
import { itUnless, nodeCliUnavailable } from './helpers/skip.js';

const bounded = {
  credentialsOnly: true,
  secretlint: false,
  oversizedRecords: 'redact',
  maxRecordBytes: 64,
};

async function collect(source, options) {
  let output = '';
  for await (const chunk of sanitizeStream(source, options)) {
    output += chunk;
  }
  return output;
}

describe('opt-in omission of oversized stream records (issue 233)', () => {
  it('discards a credential at every offset across the record limit and every chunk split', async () => {
    const credential = 'known-fixture-value';
    const options = { ...bounded, knownSecrets: [credential] };
    for (let offset = 0; offset <= credential.length; offset++) {
      const before = ' '.repeat(bounded.maxRecordBytes - offset);
      const first = Buffer.from(
        `Before.\n${before}${credential}${' '.repeat(32)}\r\nAfter.\n`
      );
      const cut = Buffer.byteLength('Before.\n') + bounded.maxRecordBytes;
      assert.equal(
        await collect([first.subarray(0, cut), first.subarray(cut)], options),
        'Before.\n[REDACTED]\r\nAfter.\n'
      );
    }
    const sample = Buffer.from(
      `Before.\n${' '.repeat(60)}${credential}\r\nAfter.\n`
    );
    for (let cut = 1; cut < sample.length; cut++) {
      assert.equal(
        await collect([sample.subarray(0, cut), sample.subarray(cut)], options),
        'Before.\n[REDACTED]\r\nAfter.\n'
      );
    }
    assert.equal(
      await collect([`${' '.repeat(44)}${credential}\n`], options),
      `${' '.repeat(44)}[REDACTED]\n`
    );
    await assert.rejects(
      collect([sample], { ...options, oversizedRecords: 'error' }),
      { code: 'ERR_LIMIT' }
    );
  });

  it('tracks multiline boundaries after discarding retained text', async () => {
    const padding = ' '.repeat(96);
    const label = `${'A'.repeat(1000)} PRIVATE KEY`;
    const cases = [
      [`password: "${padding}\ninside-fixture\n"\n`, false],
      [
        `-----BEGIN ${label}-----\n-----END RSA PRIVATE KEY-----\ninside-fixture\n-----END ${label}-----\n`,
        false,
      ],
      [
        `log: PuTTY-User-Key-File-3: ssh-rsa\n${padding}\ninside-fixture\nlog: Private-MAC:${padding}ff\n`,
        false,
      ],
      [
        `machine ${'a'.repeat(96)}\nlogin example\npassword inside-fixture\n`,
        false,
      ],
      ['YWJjZGVmZ2hpamts\n'.repeat(6), true],
    ];
    for (const [record, needsBoundaryLine] of cases) {
      const text = `Before.\n${record}${needsBoundaryLine ? 'Separator.\n' : ''}After.\n`;
      const bytes = Buffer.from(text);
      for (const size of [1, 7, 64, bytes.length]) {
        const chunks = Array.from(
          { length: Math.ceil(bytes.length / size) },
          (_, index) => bytes.subarray(index * size, (index + 1) * size)
        );
        assert.equal(
          await collect(chunks, bounded),
          'Before.\n[REDACTED]\nAfter.\n'
        );
      }
    }
  });

  it('preserves JSONL order across omission and validates encoding after overflow', async () => {
    const large = JSON.stringify({ message: 'é'.repeat(60) });
    const input = Buffer.from(`{"n":1}\r\n${large}\r\n{"n":3}\n`);
    for (const workers of [1, 2]) {
      const options = {
        ...bounded,
        structured: 'jsonl',
        batchBytes: 18,
        workers,
      };
      assert.equal(
        await collect([input.subarray(0, 64), input.subarray(64)], options),
        '{"n":1}\r\n"[REDACTED]"\r\n{"n":3}\n'
      );
      const prefix = Buffer.from(`{}\n${large.slice(0, -2)}`);
      await assert.rejects(collect([prefix, Buffer.from([0xff])], options), {
        code: 'ERR_ENCODING',
        record: 2,
        recordOffset: prefix.length - 3,
        offset: prefix.length,
      });
    }
    assert.equal(
      await collect([large], { ...bounded, structured: 'json' }),
      '"[REDACTED]"'
    );
    await assert.rejects(collect([input], { ...bounded, maxTotalBytes: 64 }), {
      code: 'ERR_LIMIT',
    });
  });

  itUnless(nodeCliUnavailable)(
    'continues an atomic worker file and CLI stdin, including two-pass mode',
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'sanitizer-233-'));
      const input = `${' '.repeat(1000)}\npassword: synthetic-value\n`;
      const expected = '[REDACTED]\npassword: [REDACTED]\n';
      try {
        const source = join(dir, 'source.txt');
        await writeFile(source, input);
        for (const twoPass of [false, true]) {
          const target = join(dir, `safe-${twoPass}.txt`);
          await sanitizeFileBounded(source, target, { ...bounded, twoPass });
          assert.equal(await readFile(target, 'utf8'), expected);
        }
        const cli = fileURLToPath(
          new URL('../bin/sensitive-data-sanitizer.js', import.meta.url)
        );
        const result = spawnSync(
          process.execPath,
          [
            cli,
            'redact',
            '-',
            '--stream',
            '--redact-oversized-records',
            '--max-record-bytes',
            '64',
            '--native-only',
            '--credentials-only',
          ],
          { input, encoding: 'utf8' }
        );
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout, expected);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
  );
});

itUnless(nodeCliUnavailable)(
  'streams a finite 16 MiB record under a 48 MiB V8 heap limit',
  () => {
    const probe = fileURLToPath(
      new URL(
        '../experiments/issue-233/bounded-stream-memory.mjs',
        import.meta.url
      )
    );
    const result = spawnSync(
      process.execPath,
      ['--max-old-space-size=48', probe],
      { encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr);
  }
);
