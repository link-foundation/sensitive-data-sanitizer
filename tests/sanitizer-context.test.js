import { describe, it, expect } from 'test-anywhere';
import { sanitize } from '../src/index.js';
import { nameExamples } from '../src/names.js';
import { boundedProbe } from './bounded-probe.js';

describe('context-specific complete spans', () => {
  it('handles a finite hostile whitespace run without polynomial matching', async () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    const probe = await boundedProbe('experiments/issue-1-prose-boundary.mjs');
    expect(probe.bytes > 128 * 1024).toBe(true);
    expect(probe.milliseconds < 1000).toBe(true);
  });
  for (const [input, expected] of [
    ['password: a b&c,d;e', 'password: [REDACTED]'],
    [
      'https://example.org/?password=a%26b&other=ok',
      'https://example.org/?password=[REDACTED]&other=ok',
    ],
    ['PASS=one OTHER=two', 'PASS=[REDACTED] OTHER=two'],
    ['PGPASSWORD=xyz psql', 'PGPASSWORD=[REDACTED] psql'],
    ['APP_PW=xyz', 'APP_PW=[REDACTED]'],
    ['PASSPHRASE="my phrase"', 'PASSPHRASE="[REDACTED]"'],
    ['CREDENTIALS=short', 'CREDENTIALS=[REDACTED]'],
    [
      'curl -u user:pass https://example.org',
      'curl -u [REDACTED] https://example.org',
    ],
    ['mysql -P 3306', 'mysql -P 3306'],
    ['psql -p 5432', 'psql -p 5432'],
    [
      JSON.stringify({ password: 'a"b\\c\nd' }),
      JSON.stringify({ password: '[REDACTED]' }),
    ],
    [
      JSON.stringify({ stdout: JSON.stringify({ password: 'a"b\\c' }) }),
      JSON.stringify({ stdout: JSON.stringify({ password: '[REDACTED]' }) }),
    ],
  ]) {
    it(`preserves structure in ${input.slice(0, 30)}`, () => {
      expect(sanitize(input).text).toBe(expected);
    });
  }
});

describe('offline multilingual names and non-Latin digits', () => {
  for (const [language, name] of nameExamples) {
    it(`detects a free-text ${language} name by default`, () => {
      expect(sanitize(`… ${name} …`).text).toBe('… [REDACTED] …');
    });
  }
  for (const zero of [0x660, 0x6f0, 0x966, 0x9e6, 0xe50]) {
    it(`maps phone and ID digit system ${zero.toString(16)}`, () => {
      const localize = (s) =>
        s.replace(/\d/g, (d) => String.fromCodePoint(zero + Number(d)));
      expect(sanitize(localize('😀 +1 (415) 555-2671')).text).toBe(
        '😀 [REDACTED]'
      );
      expect(sanitize(localize('паспорт 4509 123456')).text).toBe(
        'паспорт [REDACTED]'
      );
    });
  }
});

describe('automatic public classification priority', () => {
  it('preserves public names, organizations, resolver and role contacts', () => {
    const input =
      'Albert Einstein, company Microsoft, press@microsoft.com 8.8.8.8';
    expect(sanitize(input).text).toBe(input);
  });
  it('keeps private/unknown-domain mail and private namesakes protected', () => {
    expect(
      sanitize(
        'support@unknown.example john@microsoft.com patient Albert Einstein'
      ).text
    ).toBe('[REDACTED] [REDACTED] patient [REDACTED]');
  });
  it('lets callers force private treatment and never exempts credentials', () => {
    expect(
      sanitize('press@microsoft.com', { publicKnowledge: false }).text
    ).toBe('[REDACTED]');
    expect(sanitize('password="press@microsoft.com"').text).toBe(
      'password="[REDACTED]"'
    );
    expect(sanitize('8.8.8.8', { knownSecrets: ['8.8.8.8'] }).text).toBe(
      '[REDACTED]'
    );
  });
});
