import { it, expect } from 'test-anywhere';
import { RE2 } from 're2-wasm';
import { performance } from 'node:perf_hooks';
import { detectGitleaks } from '../src/gitleaks.js';
import { sanitize, createSanitizer } from '../src/index.js';
import { denseTokens } from './fixtures/dense-tokens.mjs';
import { measureGrowth } from './helpers/growth.js';

const token = `ghp_${'aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4'}`;
it('bounds whole-view WASM copies regardless of credential count', () => {
  const input = denseTokens(400, '\n');
  const exec = RE2.prototype.exec;
  let copies = 0;
  const findings = [];
  try {
    RE2.prototype.exec = function (text) {
      if (text === input) {
        copies++;
      }
      return exec.call(this, text);
    };
    detectGitleaks(input, (finding) => findings.push(finding));
  } finally {
    RE2.prototype.exec = exec;
  }
  expect(
    findings.filter((finding) => finding.rule === 'gitleaks/github-pat').length
  ).toBe(400);
  expect(copies <= 20).toBe(true);
});
it('retains Unicode offsets and complete matches across the engine transition', () => {
  const input = `${'🙂'} ${token}\n`.repeat(32);
  const found = [];
  detectGitleaks(input, (finding) => found.push(finding));
  const github = found.filter(
    (finding) => finding.rule === 'gitleaks/github-pat'
  );
  expect(github.length).toBe(32);
  for (let i = 0; i < github.length; i++) {
    expect(github[i].start).toBe(i * (token.length + 4) + 3);
    expect(input.slice(github[i].start, github[i].end)).toBe(token);
  }
});
it('sanitizes 256 KiB of dense tokens with linear throughput', () => {
  const tokens = (kib) => Math.ceil((kib * 1024) / (token.length + 1));
  const count = tokens(256);
  const started = performance.now();
  const result = sanitize(denseTokens(count), { credentialsOnly: true });
  const fullMs = performance.now() - started;
  expect(result.text).toBe('[REDACTED] '.repeat(count));
  // An absolute 8-second limit measured the runner, not the scanner: earlier
  // CI runs took 0.34 s to 5.3 s, and a macOS Intel runner needed more than
  // 8 s under Deno (issue 208). Compare 8x more tokens on the same machine
  // instead: linear scans grow 5-8x, and the unbounded WASM copies that
  // issue 51 removed grow 40-49x (experiments/issue-208/dense-token-growth.mjs).
  // The test timeout still bounds the whole run, and the failure message
  // shows the measurements.
  const time = (text) => {
    const begin = performance.now();
    sanitize(text, { credentialsOnly: true });
    return performance.now() - begin;
  };
  const growth = measureGrowth(
    time,
    denseTokens(tokens(4)),
    denseTokens(tokens(32))
  );
  expect(growth.ratio).toBeLessThan(24, JSON.stringify({ fullMs, ...growth }));
});
it('preserves required scanner union behavior for dense credentials', async () => {
  const count = 40;
  const input = denseTokens(count, '\n');
  expect(
    (await createSanitizer({ credentialsOnly: true }).sanitize(input)).text
  ).toBe('[REDACTED]\n'.repeat(count));
});

it('preserves capture groups, entropy filters and boundaries after switching', () => {
  const secret = 'aB3cD4eF5gH6iJ7kL8mN';
  const input = `🙂 password="${secret}" password="${'a'.repeat(20)}"; `.repeat(
    32
  );
  const findings = [];
  detectGitleaks(input, (finding) => findings.push(finding));
  const generic = findings.filter(
    (finding) => finding.rule === 'gitleaks/generic-api-key'
  );
  expect(generic.length > 8).toBe(true);
  for (const finding of generic) {
    expect(input.slice(finding.start, finding.end)).toBe(secret);
  }
  // The scoped multiline prefix and line-end boundary must survive replay.
  const key = `dp.pt.${'Ab1cD2eF3gH4'.repeat(3)}Z9yX8wV`;
  const lines = `🙂 ${key}\n`.repeat(32);
  const found = [];
  detectGitleaks(lines, (finding) => found.push(finding));
  expect(
    found.filter((finding) => finding.rule === 'gitleaks/doppler-api-token')
      .length
  ).toBe(32);
});

it('can compile every vendored text rule in the dense-match fallback', async () => {
  const { RE2JS } = await import('re2js');
  const { gitleaksRules } = await import('../src/gitleaks.js');
  for (const rule of gitleaksRules) {
    if (rule.regex) {
      expect(typeof RE2JS.compile(rule.regex).matchAll).toBe('function');
    }
  }
});
