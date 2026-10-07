import { describe, it, expect } from 'test-anywhere';
import { sanitize, createSanitizer, inspect } from '../src/index.js';
const key = 'synthetic-pseudonym-key-for-tests';
describe('typed de-identification transformations', () => {
  it('retains rule confidence and likelihood without source text', () => {
    const findings = inspect('John Smith; DE89 3704 0044 0532 0130 00');
    expect(
      findings.some(
        (f) =>
          f.type === 'IBAN' &&
          f.confidence === 0.99 &&
          f.likelihood === 'VERY_LIKELY'
      )
    ).toBe(true);
    expect(JSON.stringify(findings).includes('John')).toBe(false);
  });
  it('supports the opt-in hive mask contract and keeps short credentials opaque', async () => {
    const engine = createSanitizer({ transformation: { mode: 'hive-mask' } });
    expect((await engine.sanitize('password: abcdefghijklmnop')).text).toBe(
      'password: abc…nop'
    );
    expect((await engine.sanitize('password: short')).text).toBe(
      'password: [REDACTED]'
    );
  });
  it('keeps credentials fully redacted under personal pseudonymization', () => {
    const result = sanitize('name: John Smith\npassword: abcdefghijklmnop', {
      transformation: { mode: 'pseudonym', key },
    });
    expect(result.text.includes('John Smith')).toBe(false);
    expect(result.text.endsWith('password: [REDACTED]')).toBe(true);
    expect(result.text).toBe(
      sanitize('name: John Smith\npassword: abcdefghijklmnop', {
        transformation: { mode: 'pseudonym', key },
      }).text
    );
  });
  it('supports per-type format-preserving pseudonyms, date shifting and numeric buckets', () => {
    const options = {
      knownPersonal: [{ type: 'CUSTOM_ID', value: 'AB-123-CD' }],
      transformations: {
        CUSTOM_ID: { mode: 'format-preserving', key },
        DATE_OF_BIRTH: { mode: 'date-shift', days: 30 },
        AGE: { mode: 'bucket', size: 10 },
      },
    };
    const result = sanitize('AB-123-CD\ndob: 2000-01-01\nAGE: 43', options);
    expect(
      /^[A-Z]{2}-\d{3}-[A-Z]{2}\ndob: 2000-01-31\nAGE: 40–49$/.test(result.text)
    ).toBe(true);
    expect(result.text.startsWith('AB-123-CD')).toBe(false);
  });
  it('re-encodes transformed payloads and preserves JSON validity', () => {
    const value = 'Password: abcdefghijklmnop';
    const encoded = Buffer.from(value).toString('base64');
    const result = sanitize(JSON.stringify({ data: encoded }), {
      transformation: { mode: 'hive-mask' },
      preserveEncoding: true,
    });
    expect(Buffer.from(JSON.parse(result.text).data, 'base64').toString()).toBe(
      'Password: abc…nop'
    );
    expect(
      JSON.parse(
        sanitize('{"password":"abcdefghijk\\"lmnop"}', {
          transformation: { mode: 'hive-mask' },
        }).text
      ).password
    ).toBe('abc…nop');
  });
  it('rejects missing keys, invalid modes and overflowing date shifts', () => {
    for (const transformation of [
      { mode: 'pseudonym' },
      { mode: 'bad' },
      { mode: 'bucket', size: 0 },
      { mode: 'date-shift', days: Infinity },
    ]) {
      expect(() => sanitize('ok', { transformation })).toThrow();
    }
  });
  it('keeps escaped JSON structure while using required external detectors', async () => {
    const detector = {
      detect(text) {
        const start = text.indexOf('opaque-fixture');
        return start < 0
          ? []
          : [
              {
                start,
                end: start + 14,
                type: 'SECRET',
                category: 'credential',
                rule: 'fixture',
              },
            ];
      },
    };
    const engine = createSanitizer({
      secretlint: false,
      detectors: [detector],
    });
    const input = JSON.stringify({
      stdout: JSON.stringify({ value: 'opaque-fixture', ok: 1 }),
    });
    const result = await engine.sanitize(input);
    expect(JSON.parse(JSON.parse(result.text).stdout)).toEqual({
      value: '[REDACTED]',
      ok: 1,
    });
    const encoded = Buffer.from('opaque-fixture').toString('base64');
    const preserving = createSanitizer({
      secretlint: false,
      detectors: [detector],
      preserveEncoding: true,
    });
    expect(
      Buffer.from(
        (await preserving.sanitize(encoded)).text,
        'base64'
      ).toString()
    ).toBe('[REDACTED]');
  });
  it('redacts JSON byte escapes and refuses identity format transformations', () => {
    expect(
      JSON.parse(
        sanitize(
          '{"value":"\\u0070\\u0061\\u0073\\u0073\\u0077\\u006f\\u0072\\u0064: short"}'
        ).text
      ).value
    ).toBe('password: [REDACTED]');
    expect(
      sanitize('@@@', {
        knownPersonal: [{ type: 'CUSTOM_ID', value: '@@@' }],
        transformation: { mode: 'format-preserving', key },
      }).text
    ).toBe('[REDACTED]');
  });
});
