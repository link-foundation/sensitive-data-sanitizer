// Finite reproduction: node --max-old-space-size=256 --stack-size=4096
// experiments/issue-52/dense-tokens.mjs [maximum KiB, default 256].
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { denseTokens } from '../../tests/fixtures/dense-tokens.mjs';
import { sanitize, createSanitizer, sanitizeStream } from '../../src/index.js';

const maximum = Number(process.argv[2] ?? 256);
assert([32, 64, 128, 256].includes(maximum));
const token = `ghp_${'aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4'}`;
for (const kib of [32, 64, 128, 256].filter((size) => size <= maximum)) {
  for (const separator of ['\n', ' ']) {
    const count = Math.ceil((kib * 1024) / (token.length + 1));
    const input = denseTokens(count, separator);
    const started = performance.now();
    const result = sanitize(input, { credentialsOnly: true });
    // Long newline-only base64-alphabet runs retain the existing fail-closed
    // encoded-container policy. Space-separated tokens remain independent.
    const expected =
      separator === '\n' ? '[REDACTED]\n' : '[REDACTED] '.repeat(count);
    assert.equal(result.text, expected);
    console.log(
      JSON.stringify({
        mode: 'native',
        kib,
        separator,
        ms: performance.now() - started,
      })
    );
  }
}
if (maximum === 256) {
  const count = Math.ceil((maximum * 1024) / (token.length + 1));
  const input = denseTokens(count);
  let started = performance.now();
  const result = await createSanitizer({ credentialsOnly: true }).sanitize(
    input
  );
  assert.equal(result.text, '[REDACTED] '.repeat(count));
  console.log(
    JSON.stringify({
      mode: 'required-union',
      kib: maximum,
      ms: performance.now() - started,
    })
  );
  started = performance.now();
  let output = '';
  for await (const chunk of sanitizeStream([Buffer.from(input)], {
    credentialsOnly: true,
  })) {
    output += chunk;
  }
  assert.equal(output, '[REDACTED] '.repeat(count));
  console.log(
    JSON.stringify({
      mode: 'stream',
      kib: maximum,
      ms: performance.now() - started,
    })
  );
}
