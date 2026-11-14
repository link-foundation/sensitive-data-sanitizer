import { itUnless, nodeCliUnavailable } from './helpers/skip.js';
import { describe, it, expect } from 'test-anywhere';
import { Readable } from 'node:stream';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  sanitize,
  createSanitizer,
  inspect,
  sanitizeStream,
} from '../src/index.js';
import { authorizationRanges } from '../src/context.js';
import { runCli } from '../bin/sensitive-data-sanitizer.js';

const options = { credentialsOnly: true };
const rows = [
  ['Bearer [REDACTED] already', 'Bearer [REDACTED] already'],
  ['Bearer {{token}} x', 'Bearer [REDACTED] x'],
  ['Bearer <token> x', 'Bearer <token> x'],
  ['Bearer abc\0 tail', 'Bearer [REDACTED]\0 tail'],
  ['Bearer [opaque] x', 'Bearer [REDACTED] x'],
  ['Bearer {opaque} x', 'Bearer [REDACTED] x'],
  ['Bearer [{opaque}] x', 'Bearer [REDACTED] x'],
  ['Bearer abc] tail', 'Bearer [REDACTED]] tail'],
  ['Bearer abc} tail', 'Bearer [REDACTED]} tail'],
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
        `Authorization: Bearer [REDACTED]${control} tail`
      );
      expect(authorizationRanges(input, 15)).toEqual([{ start: 22, end: 25 }]);
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
  itUnless(nodeCliUnavailable)(
    'preserves NUL and invalid bytes through CLI file/stdin and stream paths',
    async () => {
      const directory = await mkdtemp(join(tmpdir(), 'issue-50-'));
      const input = Buffer.concat([
        Buffer.from('Authorization: Bearer abc\0 tail\n'),
        Buffer.from([255]),
        Buffer.from('\nAuthorization: Bearer [REDACTED] already\n'),
      ]);
      const expected = Buffer.concat([
        Buffer.from('Authorization: Bearer [REDACTED]\0 tail\n'),
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
              [
                'redact',
                path,
                '--credentials-only',
                '--allow-binary',
                ...flags,
              ],
              {
                stdin: Readable.from([
                  input.subarray(0, 20),
                  input.subarray(20),
                ]),
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
    }
  );
});

describe('NUL-delimited credential fields (issue 180)', () => {
  const token = `ghp_${'x'.repeat(36)}`;
  const engine = createSanitizer(options);

  it('keeps fields immediately after bare and contextual credentials', async () => {
    const rows = [
      [token, '[REDACTED]'],
      [`sk-${'a'.repeat(24)}`, '[REDACTED]'],
      [`npm_${'a'.repeat(24)}`, '[REDACTED]'],
      [`token=${token}`, 'token=[REDACTED]'],
      ['password=sample-value', 'password=[REDACTED]'],
      ['Authorization: Bearer abc', 'Authorization: Bearer [REDACTED]'],
      ['Cookie: session=sample-value', 'Cookie: session=[REDACTED]'],
    ];
    for (const [value, replacement] of rows) {
      for (const ending of ['', '\n', '\r\n']) {
        const input = `line\0one ${value}\0two\0three${ending}`;
        const expected = `line\0one ${replacement}\0two\0three${ending}`;
        expect(sanitize(input, options).text).toBe(expected);
        expect((await engine.sanitize(input)).text).toBe(expected);
        expect((await engine.sanitize(expected)).text).toBe(expected);
        for (const finding of inspect(input, options)) {
          expect(input.slice(finding.start, finding.end).includes('\0')).toBe(
            false
          );
          expect(finding.end <= input.indexOf('\0', 9)).toBe(true);
        }
      }
    }
    // Another normalization trigger must not remove the field separator.
    expect(sanitize(`\\u0061 ${token}\0two`, options).text).toBe(
      '\\u0061 [REDACTED]\0two'
    );
    expect(sanitize(`one ${token} two`, options).text).toBe(
      'one [REDACTED] two'
    );
    expect(sanitize(`${token}\0a\0b\0c\0d`, options).text).toBe(
      '[REDACTED]\0a\0b\0c\0d'
    );
  });

  it('still detects uniformly NUL-interleaved credentials in either byte order', async () => {
    for (const text of [token, 'token: "sample-value"']) {
      for (const [prefix, suffix] of [
        ['', ''],
        ['', '\0'],
        ['\0', ''],
        ['before ', ' after'],
      ]) {
        const input = prefix + [...text].join('\0') + suffix;
        const sync = sanitize(input, options);
        expect(sync.text.includes('[REDACTED]')).toBe(true);
        expect((await engine.sanitize(input)).text).toBe(sync.text);
      }
    }
  });

  it('preserves the NUL suffix at every stream chunk boundary', async () => {
    const input = Buffer.from(`line\0one ${token}\0two\n`);
    for (let split = 1; split < input.length; split++) {
      const chunks = [];
      for await (const chunk of sanitizeStream(
        [input.subarray(0, split), input.subarray(split)],
        { ...options, allowBinary: true, secretlint: false, batchBytes: 1 }
      )) {
        chunks.push(Buffer.from(chunk));
      }
      expect(Buffer.concat(chunks)).toEqual(
        Buffer.from('line\0one [REDACTED]\0two\n')
      );
    }
  });

  itUnless(nodeCliUnavailable)(
    'preserves issue 180 bytes through CLI stdin/file, stream and output paths',
    async () => {
      const directory = await mkdtemp(join(tmpdir(), 'issue-180-'));
      const input = Buffer.concat([
        Buffer.from(`line\0one ${token}\0two\n`),
        Buffer.from(`token=${token}\0three\0four\r\n`),
        Buffer.from([255]),
        Buffer.from(`\0five ${token}\0six`),
      ]);
      const expected = Buffer.concat([
        Buffer.from('line\0one [REDACTED]\0two\n'),
        Buffer.from('token=[REDACTED]\0three\0four\r\n'),
        Buffer.from([255]),
        Buffer.from('\0five [REDACTED]\0six'),
      ]);
      try {
        const source = join(directory, 'input');
        await writeFile(source, input);
        let invocation = 0;
        for (const path of ['-', source]) {
          for (const stream of [[], ['--stream']]) {
            for (const credentials of [[], ['--credentials-only']]) {
              for (const toFile of [false, true]) {
                const output = join(directory, `output-${invocation++}`);
                const chunks = [];
                const errors = [];
                const status = await runCli(
                  [
                    'redact',
                    path,
                    '--allow-binary',
                    '--max-bytes',
                    String(input.length),
                    ...stream,
                    ...credentials,
                    ...(toFile ? ['--output', output] : []),
                  ],
                  {
                    stdin: Readable.from([
                      input.subarray(0, 17),
                      input.subarray(17, 49),
                      input.subarray(49),
                    ]),
                    stdout: {
                      write: (chunk) => chunks.push(Buffer.from(chunk)),
                    },
                    stderr: { write: (chunk) => errors.push(chunk) },
                  }
                );
                expect(status).toBe(0);
                expect(errors).toEqual([]);
                expect(
                  toFile ? await readFile(output) : Buffer.concat(chunks)
                ).toEqual(expected);
                expect(Buffer.concat(chunks)).toEqual(
                  toFile ? Buffer.alloc(0) : expected
                );
              }
            }
          }
        }
        expect(await readFile(source)).toEqual(input);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  );
});
