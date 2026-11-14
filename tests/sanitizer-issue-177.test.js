import { describe, it, expect } from 'test-anywhere';
import { createSyncSanitizer } from '../src/credentials-entry.js';
import { createSanitizer, sanitizeStream } from '../src/index.js';
import { runCli } from '../bin/sensitive-data-sanitizer.js';
import { Readable } from 'node:stream';
import { itUnless, nodeCliUnavailable } from './helpers/skip.js';

// Issue 177: inside a Markdown code span the Authorization value extended
// over the closing backtick, so `<value>`, `$TOKEN` and `${TOKEN}` no longer
// looked like placeholders and the backtick was consumed by the redaction.
// The value now ends at the code span's closing delimiter, as `key=value`
// pairs do since issue 151.
const credentials = createSyncSanitizer({ credentialsOnly: true });
const full = createSanitizer();
// A hive-mind release note that the publication sanitizer used to rewrite; the words
// are split so the history-comment lint rule ignores the fixture.
const releaseNote = [
  'Fix the credential sanitizer masking the scheme word instead',
  'of the credential in `Authorization: token <value>` (and any other scheme)',
].join(' ');
const token = `ghp_${'0123456789abcdefABCDEF0123456789abcd'}`;

describe('issue 177: Authorization values in Markdown code spans', () => {
  const kept = [
    'Authorization: token <value>',
    '"Authorization: token <value>"',
    '`Authorization: token <value>`',
    '`Authorization: Bearer <token>` header',
    '`Authorization: Bearer $TOKEN`',
    '`Authorization: Bearer ${TOKEN}`',
    '`Proxy-Authorization: Basic <credentials>` header',
    releaseNote,
  ];
  for (const input of kept) {
    it(`keeps placeholder ${JSON.stringify(input)}`, async () => {
      expect(credentials.sanitize(input).text).toBe(input);
      expect((await full.sanitize(input)).text).toBe(input);
    });
  }

  it('reports no finding that includes the closing backtick', () => {
    for (const input of [
      '`Authorization: token <value>`',
      `\`Authorization: token ${token}\` after`,
    ]) {
      for (const finding of credentials.inspect(input)) {
        expect(input.slice(finding.start, finding.end).includes('`')).toBe(
          false
        );
      }
    }
    expect(
      credentials.inspect(`\`Authorization: token ${token}\``).length
    ).toBeGreaterThan(0);
  });

  it('masks a real credential and keeps the closing backtick', async () => {
    for (const [input, expected] of [
      [
        `\`Authorization: token ${token}\` after`,
        '`Authorization: token [REDACTED]` after',
      ],
      [
        '`Authorization: Bearer abcdefghijklmnopqrstuvwx1234` after',
        '`Authorization: Bearer [REDACTED]` after',
      ],
      [
        '`Proxy-Authorization: Basic dXNlcjpwYXNzd29yZA==` header',
        '`Proxy-Authorization: Basic [REDACTED]` header',
      ],
      [
        '`Authorization: Digest username=a, response=6629fae49393a05397450978507c4ef1` done',
        '`Authorization: Digest username=a, response=[REDACTED]` done',
      ],
    ]) {
      expect(credentials.sanitize(input).text).toBe(expected);
      const text = (await full.sanitize(input)).text;
      expect(text.includes(token)).toBe(false);
      expect(/\[REDACTED\]` /.test(text)).toBe(true);
    }
  });

  it('keeps masking backticks outside a code span', () => {
    expect(
      credentials.sanitize('Authorization: Bearer abc`def`ghijklmnop1234').text
    ).toBe('Authorization: Bearer [REDACTED]');
  });
});

describe('Authorization placeholders with literal backticks (issue 181)', () => {
  const wrap = (body, outer = 2, inner = 1) =>
    `for example ${'`'.repeat(outer)} ${'`'.repeat(inner)}${body}${'`'.repeat(inner)} ${'`'.repeat(outer)} in notes`;

  it('keeps complete placeholders across schemes and delimiter lengths', async () => {
    for (const [outer, inner] of [
      [2, 1],
      [3, 1],
      [3, 2],
      [256, 4],
    ]) {
      for (const header of ['Authorization', 'Proxy-Authorization']) {
        for (const scheme of ['', 'token ', 'Bearer ', 'Basic ', 'Custom ']) {
          for (const value of ['<value>', '$TOKEN', '${TOKEN}', '[REDACTED]']) {
            const input = wrap(`${header}: ${scheme}${value}`, outer, inner);
            expect(credentials.inspect(input)).toEqual([]);
            expect(credentials.sanitize(input).text).toBe(input);
            expect((await full.sanitize(input)).text).toBe(input);
          }
        }
      }
    }
    const empty = wrap('Authorization:');
    expect(credentials.sanitize(empty).text).toBe(empty);
  });

  it('preserves trailing literal backticks while masking entire real credentials', async () => {
    const opaque = ['q7W9e2R4', 't6Y8u1I3o5P0'].join('');
    for (const secret of [
      token,
      opaque,
      `abc\`${opaque}`,
      `<value>\`${opaque}`,
    ]) {
      const input = wrap(`Authorization: Bearer ${secret}`);
      const expected = wrap('Authorization: Bearer [REDACTED]');
      expect(credentials.sanitize(input).text).toBe(expected);
      expect((await full.sanitize(input)).text).toBe(expected);
      expect(credentials.sanitize(expected).text).toBe(expected);
      expect([
        ...new Set(
          credentials.inspect(input).map((f) => input.slice(f.start, f.end))
        ),
      ]).toEqual([secret]);
    }
    const input = wrap(
      `Authorization: Digest username=a, response=${opaque}`,
      3,
      2
    );
    expect(credentials.sanitize(input).text).toBe(
      wrap('Authorization: Digest username=a, response=[REDACTED]', 3, 2)
    );
    expect(
      (await createSanitizer({ credentialsOnly: true }).sanitize(input)).text
    ).toBe(wrap('Authorization: Digest username=a, response=[REDACTED]', 3, 2));
    const placeholder = wrap(
      'Authorization: Digest username=a, response=<value>'
    );
    expect(credentials.sanitize(placeholder).text).toBe(placeholder);
  });

  it('does not exempt bare or malformed values or literal suffixes', () => {
    for (const input of [
      'Authorization: Bearer <value>`',
      '\\`Authorization: Bearer <value>`',
      '`` `Authorization: Bearer <value>`',
      '`` `Authorization: Bearer <value>` ```',
      wrap('Authorization: Bearer <value>suffix'),
      wrap('Authorization: Bearer <value>`suffix'),
      wrap('password=<value>`suffix'),
      '`closed` Authorization: Bearer <value>`',
      '`previous line\nAuthorization: Bearer <value>`',
    ]) {
      expect(credentials.sanitize(input).text).not.toBe(input);
    }
    const input = 'Authorization: Bearer abc`def`ghijklmnop1234';
    expect(credentials.sanitize(input).text).toBe(
      'Authorization: Bearer [REDACTED]'
    );
    const known = wrap('Authorization: Bearer <value>');
    expect(
      createSyncSanitizer({ knownSecrets: ['<value>'] }).sanitize(known).text
    ).toContain('[REDACTED]');
  });

  it('keeps placeholders and masks credentials across every stream split', async () => {
    const input = `${wrap('Authorization: token <value>')}\n${wrap(`Authorization: token ${token}`)}\n`;
    const expected = input.replace(token, '[REDACTED]');
    for (let split = 1; split < input.length; split++) {
      let output = '';
      for await (const chunk of sanitizeStream(
        [input.slice(0, split), input.slice(split)],
        { credentialsOnly: true }
      )) {
        output += chunk;
      }
      expect(output).toBe(expected);
    }
  });

  itUnless(nodeCliUnavailable)(
    'preserves the quoted example through the CLI',
    async () => {
      const input = `${wrap('Authorization: token <value>')}\n${wrap(`Authorization: token ${token}`)}\n`;
      for (const flags of [[], ['--stream']]) {
        let output = '';
        expect(
          await runCli(['redact', '-', '--credentials-only', ...flags], {
            stdin: Readable.from([input]),
            stdout: {
              write: (chunk) => {
                output += chunk;
              },
            },
            stderr: { write() {} },
          })
        ).toBe(0);
        expect(output).toBe(input.replace(token, '[REDACTED]'));
      }
    }
  );
});
