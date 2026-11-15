/**
 * Register a test with its own per-test time bound. Every other test has the
 * 30 s bound that `node --test --test-timeout=30000` and
 * `bun test --timeout 30000` set. The 8 MiB long-run tests of issue 172 take
 * 15–20 s on a normal macOS Intel runner and up to 35 s on a slow one; they
 * check that a long run does not overflow the stack, not how fast it is
 * scanned. test-anywhere's `it(name, fn)` takes no options, so the native
 * registrar of each runtime is used: Node.js reads `{ timeout }`, Bun a third
 * argument. Deno sets no per-test bound, so test-anywhere's `it` is enough.
 */

import { it } from 'test-anywhere';

const runtime = globalThis.Bun ? 'bun' : globalThis.Deno ? 'deno' : 'node';
const native =
  runtime === 'bun'
    ? await import('bun:test')
    : runtime === 'node'
      ? await import('node:test')
      : undefined;

/** The bound of the issue 172 long-run tests: about 2.5× the slowest run. */
export const LONG_TEST_TIMEOUT = 90_000;

/**
 * @param {string} name
 * @param {number} timeout milliseconds
 * @param {() => unknown} fn
 */
export function itWithin(name, timeout, fn) {
  if (runtime === 'bun') {
    return native.test(name, fn, timeout);
  }
  if (runtime === 'node') {
    return native.it(name, { timeout }, fn);
  }
  return it(name, fn);
}
