import { describe, it, expect } from 'test-anywhere';
import { createSyncSanitizer } from '../src/credentials-entry.js';
import { createSanitizer } from '../src/index.js';

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
