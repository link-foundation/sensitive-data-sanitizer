import { describe, it, expect } from 'test-anywhere';
import { RE2 } from 're2-wasm';
import { sanitize, createSanitizer } from '../src/index.js';
import { RE2JS } from 're2js';
import { betterleaksRules, gitleaksRules } from '../src/gitleaks.js';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

describe('bundled upstream rules and decoders', () => {
  it('compiles every pinned Go pattern without translating its syntax', () => {
    expect(gitleaksRules.length).toBe(222);
    for (const rule of gitleaksRules) {
      if (rule.regex) {
        expect(typeof new RE2(rule.regex, 'gu').test).toBe('function');
      }
    }
  });
  it('adds only Betterleaks rules that the pinned Gitleaks set lacks', () => {
    const provenance = JSON.parse(
      readFileSync(
        new URL('../src/vendor/betterleaks/provenance.json', import.meta.url)
      )
    );
    expect(betterleaksRules.length).toBe(provenance.rules);
    expect(betterleaksRules.length).toBe(203);
    const ids = new Set(gitleaksRules.map((rule) => rule.id));
    for (const rule of betterleaksRules) {
      expect(ids.has(rule.id) || rule.id.startsWith('generic-')).toBe(false);
      expect(typeof new RE2(rule.regex, 'gu').test).toBe('function');
      expect(typeof RE2JS.compile(rule.regex).matchAll).toBe('function');
      for (const source of [...(rule.require ?? []), ...(rule.reject ?? [])]) {
        expect(typeof RE2JS.compile(source).test).toBe('function');
      }
    }
  });
  it('runs Betterleaks rules with their secret-only filters', async () => {
    const tail = 'aB3dE5gH7jK9mN2pQ4sT6vW8yZ1cF0xR'.repeat(3);
    const groq = `GROQ=${['gsk', '_'].join('')}${tail.slice(0, 52)}`;
    const found = await createSanitizer().inspect(groq);
    const rule = found.find((f) => f.rule === 'betterleaks/groq-api-key');
    expect([rule.confidence, groq.slice(rule.start, rule.end)]).toEqual([
      0.95,
      groq.slice(5),
    ]);
    // unkey-root-key.1 requires digits, upper and lower case and entropy.
    const weak = `${['unkey', '_'].join('')}${'a'.repeat(24)}`;
    expect(await createSanitizer().inspect(weak)).toEqual([]);
    const events = [];
    await createSanitizer({ debug: (event) => events.push(event) }).inspect(
      groq
    );
    expect(
      events.some(
        (event) =>
          event.event === 'gitleaks-rule' &&
          event.rule === 'betterleaks/groq-api-key'
      )
    ).toBe(true);
    const disabled = await createSanitizer({
      rules: { 'betterleaks/groq-api-key': false },
      allowCredentialDisable: true,
    }).inspect(groq);
    expect(disabled.some((f) => f.rule.startsWith('betterleaks/'))).toBe(false);
  });
  it('runs Gitleaks provider rules in the default engine without an executable', async () => {
    const secret = `dp.pt.${'Ab1cD2eF3gH4'.repeat(3)}Z9yX8wV`;
    const result = await createSanitizer().sanitize(`😀 ${secret} ${secret}`);
    expect(result.text).toBe('😀 [REDACTED] [REDACTED]');
    expect(
      result.findings.some((f) => f.rule === 'gitleaks/doppler-api-token')
    ).toBe(true);
  });
  it('implements quoted base64 and hex entropy detectors without masking Git commits', () => {
    const hex = '9b2c5d0e8f7a1346f0d28e7a4b69c531';
    const base64 = 'Q2R4cE9xV3V6STdhRW1SbjdUMDZLaEo5';
    expect(sanitize(`value="${hex}"`).text).toBe('value="[REDACTED]"');
    expect(sanitize(`value="${base64}"`).text).toBe('value="[REDACTED]"');
    expect(sanitize(`commit ${hex}`).text).toBe(`commit ${hex}`);
  });
  for (const encoding of ['html-decimal', 'html-hex', 'byte-escape']) {
    it(`decodes ${encoding} before credential detection`, () => {
      const token = `ghp_${'Ab1cD2'.repeat(6)}`;
      const input = Array.from(token, (c) =>
        encoding === 'html-decimal'
          ? `&#${c.charCodeAt(0)};`
          : encoding === 'html-hex'
            ? `&#x${c.charCodeAt(0).toString(16)};`
            : `\\x${c.charCodeAt(0).toString(16)}`
      ).join('');
      expect(sanitize(input).text).toBe('[REDACTED]');
    });
  }
});
