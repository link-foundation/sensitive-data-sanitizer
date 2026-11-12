import { performance } from 'node:perf_hooks';
import { describe, it, expect } from 'test-anywhere';
import { createSyncSanitizer } from '../src/credentials-entry.js';
import { createSanitizer } from '../src/index.js';
import { shortenedView } from '../src/gitleaks.js';
import { entropy } from '../src/detection.js';

// Issue 173: the vendored gitleaks `generic-api-key` view extends to the
// value's terminator, and the unbounded `[a-z0-9][a-z0-9+/]{11,}` capture
// made RE2 run its capture NFA over the whole value: `password=` and a 1 MiB
// value took 13 s (about 12 µs per character, 100× plain text). The targeted
// views now replace the inside of every long `[A-Za-z0-9+/]` run with a
// fixed filler and map offsets back, so the match is unchanged.
const options = { credentialsOnly: true, preserveEncoding: true };
const mib = 1024 * 1024;
// A deterministic high-entropy base64 value.
function base64(length, seed = 1) {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let value = '';
  for (let i = 0; i < length; i++) {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    value += alphabet[seed % 64];
  }
  return value;
}

describe('issue 173: long credential values', () => {
  it('scans `password=` and a 1 MiB value close to plain-text speed', () => {
    const engine = createSyncSanitizer(options);
    // The first call compiles the rule set.
    engine.sanitize('password=warm-up-value-123\n');
    for (const text of [
      `password=${'A'.repeat(mib)}\n`,
      `api_key: ${'A'.repeat(mib)}\n`,
    ]) {
      const started = performance.now();
      engine.sanitize(text);
      // 0.22.3 took about 13 seconds; the fix takes about half a second.
      expect(performance.now() - started).toBeLessThan(6000);
    }
  });

  it('still redacts a whole long high-entropy value after a keyword', async () => {
    const value = base64(64 * 1024, 7);
    const text = `config api_key = "${value}"\nnext line\n`;
    const sync = createSyncSanitizer(options).sanitize(text);
    expect(sync.text.includes(value.slice(0, 64))).toBe(false);
    expect(sync.text.includes(value.slice(-64))).toBe(false);
    expect(sync.text.endsWith('"\nnext line\n')).toBe(true);
    const full = await createSanitizer().sanitize(text);
    expect(full.text.includes(value.slice(30000, 30064))).toBe(false);
  });

  it('shortens only long base64 runs and maps offsets back', () => {
    const short = 'password=abc123XYZ987\n';
    expect(shortenedView(short, 5)).toEqual({ text: short, start: 5 });
    const run = base64(5000, 3);
    const text = `token=${run}== ;x ${base64(300, 4)}`;
    const view = shortenedView(text, 10);
    expect(view.source).toBe(text);
    expect(view.text.length).toBe(text.length - (5000 - 3 * 256));
    // The edges of the run survive; its inside is a fixed filler.
    expect(view.text.slice(0, 6 + 256)).toBe(text.slice(0, 6 + 256));
    expect(view.text.slice(6 + 256, 6 + 512)).toBe('A'.repeat(256));
    const after = view.text.indexOf('== ;x');
    expect(view.position(after)).toBe(text.indexOf('== ;x'));
    expect(view.position(6)).toBe(6);
    expect(view.text.slice(after)).toBe(text.slice(text.indexOf('== ;x')));
  });

  it('keeps entropy bit-identical with the character-count formula', () => {
    const reference = (value) => {
      const counts = new Map();
      for (const char of value) {
        counts.set(char, (counts.get(char) ?? 0) + 1);
      }
      let sum = 0;
      for (const count of counts.values()) {
        // The original divides by the UTF-16 length.
        const p = count / value.length;
        sum -= p * Math.log2(p);
      }
      return sum;
    };
    for (const value of [
      '',
      'aaaa',
      'abc123XYZ987',
      base64(4096, 9),
      'é😀Я—ab😀',
      'xx-…789',
    ]) {
      expect([value, entropy(value)]).toEqual([value, reference(value)]);
    }
  });
});
