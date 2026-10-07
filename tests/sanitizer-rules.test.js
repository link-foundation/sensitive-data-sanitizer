import { describe, it, expect } from 'test-anywhere';
import { RE2 } from 're2-wasm';
import { sanitize, createSanitizer } from '../src/index.js';
import { gitleaksRules } from '../src/gitleaks.js';

describe('bundled upstream rules and decoders', () => {
  it('compiles every pinned Go pattern without translating its syntax', () => {
    expect(gitleaksRules.length).toBe(222);
    for (const rule of gitleaksRules) {
      if (rule.regex) {
        expect(typeof new RE2(rule.regex, 'gu').test).toBe('function');
      }
    }
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
