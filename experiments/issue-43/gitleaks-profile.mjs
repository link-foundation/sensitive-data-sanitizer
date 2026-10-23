import { performance } from 'node:perf_hooks';
import { RE2 } from 're2-wasm';
import { gitleaksRules } from '../../src/gitleaks.js';
let state = 43;
const bytes = Buffer.alloc(75000);
for (let i = 0; i < bytes.length; i++) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  bytes[i] = state >>> 24;
}
const text = JSON.stringify({ image: bytes.toString('base64') });
for (const rule of gitleaksRules) {
  if (
    !rule.regex ||
    (rule.keywords?.length &&
      !rule.keywords.some((s) => text.toLowerCase().includes(s.toLowerCase())))
  ) {
    continue;
  }
  const regex = new RE2(rule.regex, 'gu');
  const start = performance.now();
  let n = 0;
  while (regex.exec(text) && ++n < 1000) {
    /* finite match count */
  }
  console.log(
    JSON.stringify({ name: rule.id, ms: performance.now() - start, n })
  );
}
