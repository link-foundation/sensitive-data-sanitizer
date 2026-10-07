import { describe, it, expect } from 'test-anywhere';
import { createSanitizer, sanitize, entityCatalogs } from '../src/index.js';
import { localeVocabulary, personalFieldTypes } from '../src/locales.js';
import { nameExamples } from '../src/names.js';
const values = [
  'Private Person',
  '42 Example Avenue',
  '31.12.1990',
  'AB1234567',
  '09123456789',
  'private@unknown.example',
  'Private Company',
  'private-user',
];
describe('contextual fields in every supported language', () => {
  for (const [locale, credential, ...fields] of localeVocabulary) {
    it(`redacts credentials and every personal field for ${locale}`, async () => {
      const engine = createSanitizer();
      const text = `${fields
        .map((label, i) => `${label}: ${values[i]}`)
        .join('\n')}\n${credential}: hunter2`;
      const result = await engine.sanitize(text);
      expect(result.text).toBe(
        [...fields, credential]
          .map((label) => `${label}: [REDACTED]`)
          .join('\n')
      );
      for (const type of personalFieldTypes) {
        expect(result.findings.some((f) => f.type === type)).toBe(true);
      }
      expect(
        sanitize(
          `Yesterday ${nameExamples.find(([language]) => language === locale)[1]} called.`
        ).redactions > 0
      ).toBe(true);
    });
  }
  it('detects transliterated names and inflected Russian names', () => {
    for (const name of [
      'Ivan Petrov',
      'Yamada Taro',
      'Zhang San',
      'Ивану Петрову',
      'Ивана Петрова',
    ]) {
      expect(sanitize(`Contact ${name}`).text).toBe('Contact [REDACTED]');
    }
  });
  for (const [vendor, catalog] of Object.entries(entityCatalogs)) {
    it(`detects the complete ${vendor} documented field-name catalog natively`, () => {
      for (const name of catalog.names) {
        const field = name.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
        expect(sanitize(`${field}: private-value`).text).toBe(
          `${field}: [REDACTED]`
        );
      }
    });
  }
  it('validates native CPF, NPI, DNI, PAN and crypto formats', () => {
    for (const value of [
      '529.982.247-25',
      '12345678Z',
      'ABCPE1234F',
      '1234567893',
      `0x${'a1b2'.repeat(10)}`,
    ]) {
      expect(sanitize(value).redactions > 0).toBe(true);
    }
    expect(sanitize('529.982.247-26').text).toBe('529.982.247-26');
  });
});
