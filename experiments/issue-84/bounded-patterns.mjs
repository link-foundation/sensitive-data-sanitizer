// Run with: node --max-old-space-size=256 experiments/issue-84/bounded-patterns.mjs
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { detectDocumentPatterns } from '../../src/document-patterns.js';
for (const input of [
  '-'.repeat(4096),
  `tel ${' '.repeat(4096)}`,
  'anna dot '.repeat(512),
  `тел ${' '.repeat(4096)}`,
  'образование: обычное',
  'окончил рабочий день',
]) {
  const start = performance.now();
  const findings = [];
  detectDocumentPatterns(input, (finding) => findings.push(finding));
  assert.equal(findings.length, 0);
  console.log(
    JSON.stringify({
      length: input.length,
      milliseconds: performance.now() - start,
    })
  );
}
