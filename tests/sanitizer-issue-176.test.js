import { performance } from 'node:perf_hooks';
import { describe, it, expect } from 'test-anywhere';
import { sanitizeStream } from '../src/index.js';

// Issue 176: a line such as `default = ["macro"]` or `machine learning is
// fun` started a netrc block that never completed. The stream then held the
// rest of the input and rescanned the held text for every following line,
// so sanitizing became quadratic. The netrc tracker now follows the token
// sequence and abandons an entry at the first token that breaks it.
const line = (i) =>
  `2026-11-12T00:00:00.000Z INFO ordinary log line ${i} some text here and more text to pad the line\n`;
const options = { credentialsOnly: true, secretlint: false };

async function run(input, extra = {}) {
  const output = [];
  for await (const chunk of sanitizeStream(chunks(input), {
    ...options,
    ...extra,
  })) {
    output.push(chunk);
  }
  return output.join('');
}
function* chunks(text, size = 4096) {
  for (let i = 0; i < text.length; i += size) {
    yield text.slice(i, i + size);
  }
}

describe('issue 176: netrc-looking lines in streams', () => {
  for (const trigger of [
    'default = ["macro"]\n',
    'default LocaleContext provider\n',
    'machine learning is fun\n',
  ]) {
    it(`releases ${JSON.stringify(trigger.trim())} in linear time`, async () => {
      const input =
        trigger + Array.from({ length: 30000 }, (_, i) => line(i)).join('');
      const started = performance.now();
      const output = await run(input);
      // 0.22.3 needed about 25 seconds for this input under Node.js.
      expect(performance.now() - started).toBeLessThan(10000);
      expect(output).toBe(input);
    });
  }

  it('releases batches after an abandoned entry', async () => {
    const input = `default = ["macro"]\n${Array.from({ length: 200 }, (_, i) => line(i)).join('')}`;
    const output = [];
    for await (const chunk of sanitizeStream(chunks(input, 512), {
      ...options,
      batchBytes: 1024,
    })) {
      output.push(chunk);
    }
    expect(output.length).toBeGreaterThan(1);
    expect(output.join('')).toBe(input);
  });

  it('still holds and redacts genuine multi-line netrc entries', async () => {
    const secret = 'Zx9-netrc-fixture-Value-2026';
    for (const entry of [
      `machine api.example.net\nlogin alice\npassword ${secret}\n`,
      `default\nlogin alice\npassword ${secret}\n`,
      `machine api.example.net login alice\npassword ${secret}\n`,
      `prefix text default\nlogin alice password ${secret}\n`,
    ]) {
      const input = `${line(1)}${entry}${line(2)}`;
      for (const size of [1, 7, 64]) {
        const output = [];
        for await (const chunk of sanitizeStream(chunks(input, size), {
          ...options,
          batchBytes: 8,
        })) {
          output.push(chunk);
        }
        const text = output.join('');
        expect(text.includes(secret)).toBe(false);
        expect(text.startsWith(line(1))).toBe(true);
        expect(text.endsWith(line(2))).toBe(true);
      }
    }
  });
});
