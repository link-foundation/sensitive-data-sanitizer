import { performance } from 'node:perf_hooks';
// The numeric-code-point entropy (issue 173) returns bit-identical results
// to the original string-keyed version, including lone surrogates.
import { entropy } from '../../src/detection.js';
function original(value) {
  const counts = new Map();
  for (const char of value) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  let result = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    result -= p * Math.log2(p);
  }
  return result;
}
const alphabet = [
  'a',
  'B',
  '0',
  '+',
  '=',
  'é',
  '—',
  '😀',
  '\uD83D',
  '\uDE00',
  '𝔸',
  ' ',
];
let checked = 0;
for (let round = 0; round < 200000; round++) {
  let value = '';
  const length = 1 + Math.floor(Math.random() * 40);
  for (let i = 0; i < length; i++) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  if (!Object.is(entropy(value), original(value))) {
    throw new Error(`differs on ${JSON.stringify(value)}`);
  }
  checked++;
}
const big = `${'A'.repeat(4 * 1024 * 1024)}xyz`;
let t = performance.now();
const fast = entropy(big);
const fastMs = performance.now() - t;
t = performance.now();
const slow = original(big);
console.log(
  checked,
  'random strings identical; 4 MiB',
  Object.is(fast, slow),
  Math.round(fastMs),
  'ms vs',
  Math.round(performance.now() - t),
  'ms'
);
