import { it, expect } from 'test-anywhere';
import { keywordMatcher } from '../src/keywords.js';
import { gitleaksRules } from '../src/gitleaks.js';

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
      ...gitleaksRules.flatMap((r) => r.keywords ?? []),
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
