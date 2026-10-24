// Finite cold CLI reproduction with bounded child heap and stack.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, URL } from 'node:url';
import { denseTokens } from '../../tests/fixtures/dense-tokens.mjs';

const input = denseTokens(6400);
const expected = '[REDACTED] '.repeat(6400);
const cli = fileURLToPath(
  new URL('../../bin/sensitive-data-sanitizer.js', import.meta.url)
);
for (const flags of [[], ['--stream']]) {
  const started = performance.now();
  const output = execFileSync(
    process.execPath,
    [
      '--max-old-space-size=256',
      '--stack-size=4096',
      cli,
      'redact',
      '-',
      '--credentials-only',
      '--allow-binary',
      ...flags,
    ],
    { input, encoding: 'utf8', maxBuffer: 1024 * 1024 }
  );
  assert.equal(output, expected);
  console.log(
    JSON.stringify({
      mode: flags.length ? 'cli-stream' : 'cli',
      bytes: input.length,
      ms: performance.now() - started,
    })
  );
}
