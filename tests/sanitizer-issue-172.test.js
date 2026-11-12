import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'test-anywhere';
import { detectContext } from '../src/context.js';
import { createSyncSanitizer } from '../src/credentials-entry.js';
import { createSanitizer, sanitizeFileToFile } from '../src/index.js';
import { flatRegExp, unicodeRun } from '../src/unicode-runs.js';

// Issue 172: with the `u` flag, V8 compiles a class that can match an astral
// code point (`[\p{L}\p{N}]`) as a non-simple loop on a two-byte string (one
// holding any character above U+00FF). Each character of a long letter run
// then took a backtracking entry, and a 4 MiB run next to an emoji, a `—` or
// a hive mask (`xx-…789`) overflowed the regular-expression stack, so
// `sanitize()` failed closed with ERR_SANITIZATION. One-byte strings passed.
// Before the fix 4 MiB failed in credentialPrefix and 6 MiB in the e-mail
// scans; 8 MiB keeps a margin.
const large = 8 * 1024 * 1024;
const secret = 'xx-private-value';
const run = (unit, bytes) => unit.repeat(Math.ceil(bytes / unit.length));
const options = { maxInputLength: 64 * 1024 * 1024 };
const tails = {
  'emoji + token': '\n🔐 token refreshed\n',
  'hive mask': '\npassword=xx-…789\n',
  'dash + secret': `\n— password=${secret}\n`,
};

describe('issue 172: long runs in two-byte strings', () => {
  it('scans credential keys after an 8 MiB run without overflowing', () => {
    for (const unit of ['A', 'Ab', 'a1', 'A_', 'Я']) {
      const text = `${run(unit, large)}\n— password=${secret}\n`;
      const found = [];
      detectContext(text, (finding) => found.push(finding), true);
      expect(
        found.map((finding) => text.slice(finding.start, finding.end))
      ).toEqual([secret]);
    }
  });

  it('keeps keys glued to a long run detectable', () => {
    for (const text of [
      `— ${run('Ab', large)}ClientSecret: ${secret}\n`,
      `— ${run('a', large)}_password: ${secret}\n`,
    ]) {
      const found = [];
      detectContext(text, (finding) => found.push(finding), true);
      expect([
        ...new Set(found.map((f) => text.slice(f.start, f.end))),
      ]).toEqual([secret]);
    }
  });

  it('sanitizes the issue reproduction through createSyncSanitizer', () => {
    const engine = createSyncSanitizer({ credentialsOnly: true, ...options });
    for (const [name, tail] of Object.entries(tails)) {
      const result = engine.sanitize(run('Ab', large) + tail);
      expect([name, result.text.includes(secret)]).toEqual([name, false]);
    }
  });

  it('sanitizes a long run with personal data through createSanitizer', async () => {
    const text = `${run('A', large)}\n🔐 token refreshed — mail jane.doe@example.com\npassword=${secret}\n`;
    const result = await createSanitizer(options).sanitize(text);
    expect(result.text.includes(secret)).toBe(false);
    expect(result.text.includes('jane.doe@example.com')).toBe(false);
  });

  it('sanitizes the gh-upload-log record shape through sanitizeFileToFile', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'issue-172-'));
    try {
      const input = join(dir, 'in.log');
      const output = join(dir, 'out.log');
      writeFileSync(
        input,
        `✅ step started — ok\n{"type":"image","data":"${run('A', 6 * 1024 * 1024)}"}\n🔐 token refreshed\npassword=${secret}\n`
      );
      await sanitizeFileToFile(input, output, options);
      const text = readFileSync(output, 'utf8');
      expect(text.includes(secret)).toBe(false);
      expect(text.includes('🔐 token refreshed')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('spells a class loop that matches what the plain loop matches', () => {
    const samples = ['ab', 'Ab𝐀c', '𠀀', 'é—Я', '1_2', '😀', '', 'a b', '𝐀𝐁x'];
    for (const cls of ['[\\p{L}\\p{N}]', '[\\p{Ll}\\p{Lu}\\p{N}]', '[^\\s:]']) {
      for (const quantifier of ['+', '*', '+?', '*?']) {
        for (const flags of ['u', 'iu']) {
          const plain = new RegExp(`^${cls}${quantifier}$`, flags);
          const spelled = new RegExp(
            `^${unicodeRun(cls, quantifier, flags.includes('i'))}$`,
            flags
          );
          for (const sample of samples) {
            expect([cls, quantifier, sample, spelled.test(sample)]).toEqual([
              cls,
              quantifier,
              sample,
              plain.test(sample),
            ]);
          }
        }
      }
    }
  });

  it('keeps a spelled loop flat on an 8 MiB two-byte run', () => {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${unicodeRun('[\\p{L}\\p{N}]')}:`,
      'gu'
    );
    const text = `${run('A', large)}: —`;
    expect([...text.matchAll(pattern)].length).toBe(1);
  });

  it('flattens every class loop of a regular expression without changing matches', () => {
    const samples = [
      'abc def',
      'Ab𝐀c x',
      'https://a.b/😀 x',
      'паспорт1 ПАСПОРТи',
      'e\u0301\u0301x',
      'zq: z😀:',
    ];
    for (const pattern of [
      /[\p{L}\p{M}]+/gu,
      /https?:\/\/[^\s"<>\\]+/gu,
      /(?<![\p{L}\p{N}_])паспорт[\p{L}]*/giu,
      /(?<![\p{L}\p{N}_.-])[\p{L}\p{N}_.-]{2,}?x/gu,
      /[\s\S]\p{M}*/gu,
      /(?<!\p{L}+)(?<![^:])z[^:]*:/gu,
    ]) {
      const flat = flatRegExp(pattern);
      const spans = (regex, text) =>
        [...text.matchAll(regex)].map((m) => [m.index, m[0]]);
      for (const sample of samples) {
        expect([pattern.source, spans(flat, sample)]).toEqual([
          pattern.source,
          spans(pattern, sample),
        ]);
      }
    }
    const letters = flatRegExp(/[\p{L}]+/gu);
    const text = `${run('a', large)} —`;
    expect(text.replace(letters, (word) => String(word.length))).toBe(
      `${large} —`
    );
  });
});
