import { it, expect } from 'test-anywhere';
import { RE2 } from 're2-wasm';
import { performance } from 'node:perf_hooks';
import { detectGitleaks } from '../src/gitleaks.js';
import { sanitize, createSanitizer } from '../src/index.js';
import { denseTokens } from './fixtures/dense-tokens.mjs';

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
it('sanitizes 256 KiB of dense tokens within a finite throughput budget', () => {
  const count = Math.ceil((256 * 1024) / (token.length + 1));
  const input = denseTokens(count);
  const started = performance.now();
  const result = sanitize(input, { credentialsOnly: true });
  expect(result.text).toBe('[REDACTED] '.repeat(count));
  expect(performance.now() - started < 8000).toBe(true);
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
