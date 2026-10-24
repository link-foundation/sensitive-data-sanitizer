import { it, expect } from 'test-anywhere';
import { jsonStringRuns } from '../src/json-string-runs.js';

it('matches the former bounded regex on valid, malformed, escaped and overlong strings', () => {
  const pattern = /"(?:[^"\\\r\n]|\\[^\r\n]){1,8192}"/g;
  const texts = [
    '""x"',
    '"a""b"',
    '"unterminated',
    `"${'a'.repeat(8193)}\\"tail"`,
    '\\"x'.repeat(10000),
    JSON.stringify({ text: 'password: hunter2\n"quoted"' }),
  ];
  let seed = 48;
  const alphabet = ['a', 'b', '"', '\\', '\r', '\n', '🧠'];
  for (let trial = 0; trial < 1000; trial++) {
    let text = '';
    for (let i = 0; i < 100; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      text += alphabet[seed % alphabet.length];
    }
    texts.push(text);
  }
  for (const text of texts) {
    expect([...jsonStringRuns(text)].map((m) => [m.index, m[0]])).toEqual(
      [...text.matchAll(pattern)].map((m) => [m.index, m[0]])
    );
  }
});
