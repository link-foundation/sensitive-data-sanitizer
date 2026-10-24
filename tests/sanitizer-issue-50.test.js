import { describe, it, expect } from 'test-anywhere';
import { Readable } from 'node:stream';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sanitize, createSanitizer, inspect } from '../src/index.js';
import { authorizationRange } from '../src/context.js';
import { runCli } from '../bin/sensitive-data-sanitizer.js';

const options = { credentialsOnly: true };
const rows = [
  ['Bearer [REDACTED] already', 'Bearer [REDACTED] already'],
  ['Bearer {{token}} x', '[REDACTED] x'],
  ['Bearer <token> x', 'Bearer <token> x'],
  ['Bearer abc\0 tail', '[REDACTED]\0 tail'],
  ['Bearer [opaque] x', '[REDACTED] x'],
  ['Bearer {opaque} x', '[REDACTED] x'],
  ['Bearer [{opaque}] x', '[REDACTED] x'],
  ['Bearer abc] tail', '[REDACTED]] tail'],
  ['Bearer abc} tail', '[REDACTED]} tail'],
];
describe('Authorization token boundaries (issue 50)', () => {
  for (const header of ['Authorization', 'Proxy-Authorization']) {
    for (const [value, replacement] of rows) {
      it(`preserves complete tokens and surroundings: ${header} ${JSON.stringify(value)}`, async () => {
        const input = `${header}: ${value}`;
        const expected = `${header}: ${replacement}`;
        expect(sanitize(input, options).text).toBe(expected);
        const engine = createSanitizer(options);
        expect((await engine.sanitize(input)).text).toBe(expected);
        expect((await engine.sanitize(expected)).text).toBe(expected);
        expect(sanitize(expected, options).text).toBe(expected);
      });
    }
  }
  it('preserves every C0 control and DEL after a credential in both detectors', () => {
    for (let code = 0; code <= 127; code++) {
      if (code > 31 && code !== 127) {
        continue;
      }
      const control = String.fromCharCode(code);
      const input = `Authorization: Bearer abc${control} tail`;
      expect(sanitize(input, options).text).toBe(
        `Authorization: [REDACTED]${control} tail`
      );
      expect(authorizationRange(input, 15)).toEqual({ start: 15, end: 25 });
      for (const finding of inspect(input, options)) {
        expect(finding.end <= 25).toBe(true);
      }
    }
  });
  it('keeps placeholder behavior across schemes, quotes and JSON escape depths', async () => {
    for (const scheme of ['token', 'Bearer', 'Basic', 'Digest', 'Api-Token']) {
      for (const [value, replacement] of rows.slice(0, 3)) {
        let input = `curl -H "Authorization: ${value.replace('Bearer', scheme)}" after`;
        let expected = `curl -H "Authorization: ${replacement.replace('Bearer', scheme)}" after`;
        for (let depth = 0; depth < 3; depth++) {
          expect(sanitize(input, options).text).toBe(expected);
          expect((await createSanitizer(options).sanitize(input)).text).toBe(
            expected
          );
          input = JSON.stringify({ prompt: input });
          expected = JSON.stringify({ prompt: expected });
        }
      }
    }
  });
  it('preserves NUL and invalid bytes through CLI file/stdin and stream paths', async () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    const directory = await mkdtemp(join(tmpdir(), 'issue-50-'));
    const input = Buffer.concat([
      Buffer.from('Authorization: Bearer abc\0 tail\n'),
      Buffer.from([255]),
      Buffer.from('\nAuthorization: Bearer [REDACTED] already\n'),
    ]);
    const expected = Buffer.concat([
      Buffer.from('Authorization: [REDACTED]\0 tail\n'),
      Buffer.from([255]),
      Buffer.from('\nAuthorization: Bearer [REDACTED] already\n'),
    ]);
    try {
      const source = join(directory, 'input');
      await writeFile(source, input);
      expect(await readFile(source)).toEqual(input);
      for (const path of ['-', source]) {
        for (const flags of [[], ['--stream']]) {
          const chunks = [];
          const errors = [];
          const status = await runCli(
            ['redact', path, '--credentials-only', '--allow-binary', ...flags],
            {
              stdin: Readable.from([input.subarray(0, 20), input.subarray(20)]),
              stdout: { write: (chunk) => chunks.push(Buffer.from(chunk)) },
              stderr: { write: (chunk) => errors.push(chunk) },
            }
          );
          expect(status).toBe(0);
          expect(errors).toEqual([]);
          expect(Buffer.concat(chunks)).toEqual(expected);
        }
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
