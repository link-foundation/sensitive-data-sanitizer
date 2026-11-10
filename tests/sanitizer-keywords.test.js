import { it, expect } from 'test-anywhere';
import { keywordMatcher } from '../src/keywords.js';
import { betterleaksRules, gitleaksRules } from '../src/gitleaks.js';

it('matches includes semantics for overlapping keywords and the full vendored dictionary', () => {
  const words = [
    ...new Set([
      'a',
      'ab',
      'abc',
      'b',
      'bc',
      'she',
      'he',
      'hers',
      'his',
      ...[...gitleaksRules, ...betterleaksRules].flatMap(
        (r) => r.keywords ?? []
      ),
    ]),
  ];
  const match = keywordMatcher(words);
  for (const text of [
    'ushers abc his',
    words.join(' '),
    words.slice().reverse().join(''),
    'ordinary source output',
  ]) {
    expect([...match(text)].sort()).toEqual(
      words.filter((word) => text.includes(word)).sort()
    );
  }
});

it('skips irrelevant padding without losing overlaps or literal Unicode starters', () => {
  const words = [
    'ab',
    'abc',
    'bc',
    'private key',
    '[x]',
    '\\x',
    '-x',
    '^x',
    '🙂key',
    'ключ',
  ];
  const match = keywordMatcher(words);
  for (const text of [
    `${' '.repeat(200000)}abc [x] \\x -x ^x 🙂key ключ private key`,
    'a   bc ababc private   key',
    ' '.repeat(200000),
    words.join(''),
  ]) {
    expect([...match(text)].sort()).toEqual(
      words.filter((word) => text.includes(word)).sort()
    );
  }
});
