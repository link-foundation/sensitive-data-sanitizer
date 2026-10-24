// Prepare the baseline once from the unmodified revision:
// git show 9e21525:src/gitleaks.js | sed "s|from './|from '../src/|g" > ci-logs/baseline-gitleaks.mjs
// Run with node --max-old-space-size=256 --stack-size=4096.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { RE2 } from 're2-wasm';
import { denseTokens } from '../../tests/fixtures/dense-tokens.mjs';
const { detectGitleaks } = await import(
  process.argv.includes('--baseline')
    ? '../../ci-logs/baseline-gitleaks.mjs'
    : '../../src/gitleaks.js'
);
for (const kib of [32, 64]) {
  const count = Math.ceil((kib * 1024) / 41);
  const input = denseTokens(count);
  const exec = RE2.prototype.exec;
  let copies = 0;
  let found = 0;
  const started = performance.now();
  try {
    RE2.prototype.exec = function (text) {
      if (text === input) {
        copies++;
      }
      return exec.call(this, text);
    };
    detectGitleaks(input, (finding) => {
      if (finding.rule === 'gitleaks/github-pat') {
        found++;
      }
    });
  } finally {
    RE2.prototype.exec = exec;
  }
  assert.equal(found, count);
  console.log(
    JSON.stringify({ kib, copies, found, ms: performance.now() - started })
  );
}
