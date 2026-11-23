import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect } from 'test-anywhere';
import { itUnless } from './helpers/skip.js';

// Issue 200: a test registered through itWithin keeps its own bound when the
// runner caps every test at a shorter one, as CI does with 30 s.
const helper = pathToFileURL(
  join(import.meta.dirname, 'helpers', 'long-test.js')
).href;
const bun = Boolean(globalThis.Bun);
const runFixture = (bound, sleep) => {
  const dir = mkdtempSync(join(tmpdir(), 'long-test-'));
  try {
    const file = join(dir, 'bound.test.js');
    writeFileSync(
      file,
      `import { itWithin } from ${JSON.stringify(helper)};\n` +
        `itWithin('bounded', ${bound}, () => new Promise((done) => setTimeout(done, ${sleep})));\n`
    );
    const args = bun
      ? ['test', '--timeout', '300', file]
      : [
          '--test',
          // Run this single fixture without Node 22's parent file timer.
          ...(process.versions.node.startsWith('22.')
            ? ['--experimental-test-isolation=none']
            : []),
          '--test-timeout=300',
          file,
        ];
    // A nested `node --test` that has NODE_TEST_CONTEXT in its environment,
    // even a blank one, reports to this runner; without it the child is a
    // test run of its own.
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT')
    );
    return spawnSync(process.execPath, args, {
      encoding: 'utf8',
      env,
      timeout: 20_000,
    }).status;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('issue 200: per-test bounds', () => {
  const it = itUnless(
    globalThis.Deno && 'Deno sets no per-test bound to override'
  );
  it('lets a test run past the runner-wide bound within its own', () => {
    expect(runFixture(5000, 700)).toBe(0);
  });
  it('still fails a test that runs past its own bound', () => {
    expect(runFixture(200, 700)).not.toBe(0);
  });
});
