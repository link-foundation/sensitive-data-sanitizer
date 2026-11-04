// Finite large-record probe; run with node --max-old-space-size=512.
import { performance } from 'node:perf_hooks';
import { inspect } from '../../src/sanitizer.js';
const text = 'ordinary '.repeat(600000);
const rules = new Map();
const started = performance.now();
inspect(text, {
  debug(event) {
    if (event.event === 'gitleaks-rule') {
      rules.set(event.rule, event.ms);
    }
  },
});
console.log(
  JSON.stringify(
    {
      characters: text.length,
      ms: performance.now() - started,
      slowest: [...rules].sort((a, b) => b[1] - a[1]).slice(0, 10),
    },
    null,
    2
  )
);
