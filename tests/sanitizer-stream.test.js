import { describe, it, expect } from 'test-anywhere';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sanitizeStream, sanitizeFileBounded } from '../src/index.js';
async function collect(chunks, options) {
  let result = '';
  for await (const chunk of sanitizeStream(chunks, options)) {
    result += chunk;
  }
  return result;
}
describe('bounded publication sanitization', () => {
  it('holds split UTF-8, quoted credentials, PEM and wrapped base64 groups at every boundary', async () => {
    const encoded = Buffer.from('password: abcdefghijklmnop')
      .toString('base64')
      .match(/.{1,16}/g)
      .join('\n');
    const input = `Привет\n{"password":"a\\"b"}\n-----BEGIN PRIVATE KEY-----\nYWJjZGVmZ2hpamtsbW5vcA==\n-----END PRIVATE KEY-----\n${encoded}\nDone.\n`;
    const bytes = Buffer.from(input);
    const expected =
      'Привет\n{"password":"[REDACTED]"}\n[REDACTED]\n[REDACTED]\nDone.\n';
    for (let i = 1; i < bytes.length; i++) {
      expect(
        await collect([bytes.subarray(0, i), bytes.subarray(i)], {
          secretlint: false,
        })
      ).toBe(expected);
    }
  });
  it('fails closed when a held record exceeds the configured bound', async () => {
    let blocked = false;
    try {
      await collect(['password: ', 'a'.repeat(129)], { maxRecordBytes: 128 });
    } catch (e) {
      blocked = e.code === 'ERR_LIMIT';
    }
    expect(blocked).toBe(true);
  });
  it('processes a file larger than 10 MiB in a bounded worker and publishes privately', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sanitizer-large-'));
    try {
      const input = join(directory, 'input.txt'),
        output = join(directory, 'output.txt');
      await writeFile(
        input,
        `${'ordinary log record\n'.repeat(600000)}password: secret\n`
      );
      const result = await sanitizeFileBounded(input, output, {
        secretlint: false,
        batchBytes: 512 * 1024,
      });
      expect(result.inputBytes > 10 * 1024 * 1024).toBe(true);
      expect(
        (await readFile(output, 'utf8')).endsWith('password: [REDACTED]\n')
      ).toBe(true);
      expect((await stat(output)).mode & 0o777).toBe(0o600);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('blocks publication on a late invalid UTF-8 record and cleans temporary files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sanitizer-late-'));
    try {
      const input = join(directory, 'input.txt'),
        output = join(directory, 'output.txt');
      await writeFile(
        input,
        Buffer.concat([Buffer.from('ok\n'), Buffer.from([0xff])])
      );
      let blocked = false;
      try {
        await sanitizeFileBounded(input, output);
      } catch {
        blocked = true;
      }
      expect(blocked).toBe(true);
      let exists = true;
      try {
        await stat(output);
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
