import { describe, it, expect } from 'test-anywhere';
import { performance } from 'node:perf_hooks';
import { sanitize, sanitizeStream, createSanitizer } from '../src/index.js';

async function collect(source, options = {}) {
  let text = '';
  for await (const chunk of sanitizeStream(source, {
    secretlint: false,
    credentialsOnly: true,
    ...options,
  })) {
    text += chunk;
  }
  return text;
}

describe('long tool logs (issues 41/42)', () => {
  it('scans a repeated run within a finite time budget', () => {
    const input = 'A'.repeat(100000);
    const start = performance.now();
    expect(sanitize(input).text).toBe(input);
    expect(performance.now() - start < 5000).toBe(true);
  });
  it('accepts long single records by default without leaking a split header tail', async () => {
    const token = 'AbCdEf0123456789'.repeat(70000);
    const input = `Authorization: Bearer ${token}\n`;
    async function* chunks() {
      for (let i = 0; i < input.length; i += 65536) {
        yield Buffer.from(input.slice(i, i + 65536));
      }
    }
    const text = await collect(chunks());
    expect(text.includes('AbCdEf0123456789')).toBe(false);
    expect(text.includes('[REDACTED]')).toBe(true);
  });
  it('keeps an explicit record limit and total input limit enforceable', async () => {
    for (const limits of [{ maxRecordBytes: 50 }, { maxTotalBytes: 50 }]) {
      let code;
      try {
        await collect([Buffer.from('A'.repeat(51))], limits);
      } catch (error) {
        code = error.code;
      }
      expect(code).toBe('ERR_LIMIT');
    }
  });
  it('redacts credentials after a long benign line through the required union', async () => {
    const input = `${'A'.repeat(1100000)}\npassword: hunter2\n`;
    const result = await createSanitizer({ credentialsOnly: true }).sanitize(
      input
    );
    expect(result.text.endsWith('password: [REDACTED]\n')).toBe(true);
  });
});

it('handles rollout-sized runs without overflowing the regex stack', async () => {
  const { serviceRules } = await import('../src/rules.js');
  const { decodedRuns } = await import('../src/encoded.js');
  const text = 'A'.repeat(15700000);
  const regex = serviceRules.find(([name]) => name === 'firebase')[1];
  expect(new RegExp(regex).test(text)).toBe(false);
  expect([...decodedRuns(text)]).toEqual([]);
});
