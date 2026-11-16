import { describe, it, expect } from 'test-anywhere';
import { LONG_TEST_TIMEOUT, itWithin } from './helpers/long-test.js';
import { large, run, secret } from './helpers/issue-172.js';
import { detectContext } from '../src/context.js';
import { flatRegExp, unicodeRun } from '../src/unicode-runs.js';

// The detector and regular-expression part of the issue 172 tests (see
// helpers/issue-172.js). The engine and file-to-file tests live in
// sanitizer-issue-172-engines.test.js and sanitizer-issue-172-file.test.js.
describe('issue 172: long runs in two-byte strings', () => {
  itWithin(
    'scans credential keys after an 8 MiB run without overflowing',
    LONG_TEST_TIMEOUT,
    () => {
      for (const unit of ['A', 'Ab', 'a1', 'A_', 'Я']) {
        const text = `${run(unit, large)}\n— password=${secret}\n`;
        const found = [];
        detectContext(text, (finding) => found.push(finding), true);
        expect(
          found.map((finding) => text.slice(finding.start, finding.end))
        ).toEqual([secret]);
      }
    }
  );

  itWithin(
    'keeps keys glued to a long run detectable',
    LONG_TEST_TIMEOUT,
    () => {
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
    }
  );

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
