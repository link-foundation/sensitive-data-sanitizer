// Times sanitize() on dense GitHub tokens, cold and warm, and prints the
// same-machine growth the issue-51 throughput test asserts (issue 208: an
// absolute 8 s limit failed on a slow macOS Intel runner).
// Usage: node experiments/issue-208/dense-token-growth.mjs [SHORT_KIB LONG_KIB]
import { performance } from 'node:perf_hooks';
import { sanitize } from '../../src/index.js';
import { denseTokens } from '../../tests/fixtures/dense-tokens.mjs';
import { measureGrowth } from '../../tests/helpers/growth.js';

const token = `ghp_${'aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4'}`;
const [shortKib = 8, longKib = 64] = process.argv.slice(2).map(Number);
const input = (kib) =>
  denseTokens(Math.ceil((kib * 1024) / (token.length + 1)));
const time = (text) => {
  const started = performance.now();
  sanitize(text, { credentialsOnly: true });
  return performance.now() - started;
};
const cold = time(input(shortKib));
const started = performance.now();
const growth = measureGrowth(time, input(shortKib), input(longKib));
console.log(
  JSON.stringify({
    shortKib,
    longKib,
    coldMs: Math.round(cold),
    growthMs: Math.round(performance.now() - started),
    ratio: Number(growth.ratio.toFixed(2)),
    short: growth.short.map(Math.round),
    long: growth.long.map(Math.round),
  })
);
