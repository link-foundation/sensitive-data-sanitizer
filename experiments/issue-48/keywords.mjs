import { performance } from 'node:perf_hooks';
import { keywordMatcher } from '../../src/keywords.js';
import { gitleaksRules } from '../../src/gitleaks.js';
const words = [
  ...new Set(
    gitleaksRules.flatMap((r) => r.keywords ?? []).map((w) => w.toLowerCase())
  ),
];
const text =
  'INFO ordinary output line http://127.0.0.1/session konard@example.com\n'
    .repeat(30000)
    .toLowerCase();
for (const [kind, match] of [
  ['automaton', keywordMatcher(words)],
  ['includes', (t) => new Set(words.filter((w) => t.includes(w)))],
]) {
  const start = performance.now();
  for (let i = 0; i < 5; i++) {
    match(text);
  }
  console.log({ kind, ms: performance.now() - start });
}
