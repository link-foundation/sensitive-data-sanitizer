import { describe, it, expect } from 'test-anywhere';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sanitizeFileBounded, sanitizeStreamToFile } from '../src/index.js';

async function writable() {
  return (
    typeof Deno === 'undefined' ||
    (await Deno.permissions.query({ name: 'write', path: tmpdir() })).state ===
      'granted'
  );
}
const bad = Buffer.from([0xff, 0xfe, 0xc3, 0x28, 0xe2, 0x82]);
describe('lossless text log publication (issues 41/42)', () => {
  for (const twoPass of [false, true]) {
    it(`preserves invalid bytes, Unicode and sanitizes text across every split, twoPass=${twoPass}`, async () => {
      if (!(await writable())) {
        return;
      }
      const dir = await mkdtemp(join(tmpdir(), 'issue-43-bytes-'));
      try {
        const source = Buffer.concat([
          Buffer.from('你好 🙂\n'),
          bad,
          Buffer.from('\npassword: hunter2\nend\n'),
        ]);
        const expected = Buffer.concat([
          Buffer.from('你好 🙂\n'),
          bad,
          Buffer.from('\npassword: [REDACTED]\nend\n'),
        ]);
        for (let split = 0; split <= source.length; split++) {
          const target = join(dir, 'out');
          await sanitizeStreamToFile(
            [source.subarray(0, split), source.subarray(split)],
            target,
            { secretlint: false, twoPass, replace: true }
          );
          expect([...(await readFile(target))]).toEqual([...expected]);
        }
        const input = join(dir, 'in');
        await writeFile(input, source);
        await sanitizeFileBounded(input, join(dir, 'worker'), {
          twoPass,
          secretlint: false,
        });
        expect([...(await readFile(join(dir, 'worker')))]).toEqual([
          ...expected,
        ]);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  }
});

it('round-trips every byte and applies the default engine union to the valid surrounding text', async () => {
  const { decodeLogBytes, encodeLogText, createSanitizer } =
    await import('../src/index.js');
  const bytes = Buffer.from(Array.from({ length: 256 }, (_, index) => index));
  expect([...encodeLogText(decodeLogBytes(bytes))]).toEqual([...bytes]);
  const source = Buffer.concat([bad, Buffer.from('\npassword: hunter2\n🙂')]);
  const result = await createSanitizer().sanitize(decodeLogBytes(source));
  expect([...encodeLogText(result.text)]).toEqual([
    ...Buffer.concat([bad, Buffer.from('\npassword: [REDACTED]\n🙂')]),
  ]);
});
