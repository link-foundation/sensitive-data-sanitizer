import { describe, it, expect } from 'test-anywhere';
import {
  sanitize,
  inspect,
  redact,
  nationalRules,
  identifierChecks,
  createIdentifierDetector,
} from '../src/index.js';
import * as checks from '../src/national-checks.js';

// Documented sample identifiers from Presidio, Google Sensitive Data
// Protection, Azure and AWS docs, or issuing-authority specimen values. All are
// public examples; none identifies a real person.
const contextual = [
  ['US_ITIN', 'My ITIN is 911-70-1234', '911-70-1234'],
  ['ABA_ROUTING_NUMBER', 'routing number 121000358', '121000358'],
  ['US_BANK_NUMBER', 'bank account number 123456789012', '123456789012'],
  ['US_DRIVER_LICENSE', 'US driver license: H12234567', 'H12234567'],
  [
    'UK_DRIVING_LICENCE',
    'driving licence MORGA657054SM9IJ',
    'MORGA657054SM9IJ',
  ],
  [
    'UK_NATIONAL_INSURANCE_NUMBER',
    'national insurance number QQ123456C',
    'QQ123456C',
  ],
  ['ES_NIE', 'NIE X1234567L', 'X1234567L'],
  ['IT_VAT_CODE', 'partita IVA 07643520567', '07643520567'],
  ['AU_ABN', 'ABN 51 824 753 556', '51 824 753 556'],
  ['AU_ACN', 'ACN 005 499 981', '005 499 981'],
  ['AU_MEDICARE', 'Medicare 2123 45670 1', '2123 45670 1'],
  ['IN_AADHAAR', 'Aadhaar 2345 6789 0124', '2345 6789 0124'],
  ['IN_GSTIN', 'GSTIN 27AAPFU0939F1ZV', '27AAPFU0939F1ZV'],
  ['IN_VOTER', 'voter id ABE1234566', 'ABE1234566'],
  ['FI_PERSONAL_IDENTITY_CODE', 'henkilötunnus 131052-308T', '131052-308T'],
  ['TH_TNIN', 'Thai ID 1101700207030', '1101700207030'],
  ['MEDICAL_LICENSE', 'DEA number BB1388568', 'BB1388568'],
  ['IMEI', 'IMEI 490154203237518', '490154203237518'],
  ['SWIFT_CODE', 'SWIFT code DEUTDEFF500', 'DEUTDEFF500'],
  ['SG_UEN', 'UEN 53312345A', '53312345A'],
];

describe('competitor national and financial identifiers (#128)', () => {
  for (const [type, input, value] of contextual) {
    it(`redacts the whole ${type} value next to its label`, () => {
      const output = sanitize(input).text;
      expect(output.includes(value)).toBe(false);
      expect(output.endsWith('[REDACTED]')).toBe(true);
      expect(
        inspect(input).some(
          (f) => f.type === type && input.slice(f.start, f.end) === value
        )
      ).toBe(true);
    });
  }
  for (const input of [
    'SWIFT TRANSFER COMPLETED',
    'order 123456789012 shipped',
    'build 1101700207031 finished',
    'request id 2345 6789 0125',
  ]) {
    it(`keeps unlabelled or invalid lookalikes: ${input}`, () => {
      expect(sanitize(input).text).toBe(input);
    });
  }
  it('keeps checksum-valid numbers without context below the default threshold', () => {
    for (const input of ['ref 121000358', 'ref 2345 6789 0124']) {
      expect(sanitize(input).text).toBe(input);
      expect(sanitize(input, { profile: 'publication' }).text).not.toBe(input);
    }
  });
  it('treats distinctive formats as identifiers without a label', () => {
    for (const value of ['27AAPFU0939F1ZV', '131052-308T', 'X1234567L']) {
      expect(sanitize(`value ${value} end`).text).toBe('value [REDACTED] end');
    }
  });
});

describe('label words are not names or values (#128)', () => {
  it('does not treat "My ITIN" as a person name', () => {
    expect(
      inspect('My ITIN is 911-70-1234').some((f) => f.type === 'PERSON')
    ).toBe(false);
  });
  for (const [input, expected] of [
    ['my passport number is 912803456', 'my passport number is [REDACTED]'],
    ['passport is 912803456', 'passport is [REDACTED]'],
    ['Passport No: 912803456', 'Passport No: [REDACTED]'],
  ]) {
    it(`keeps the label and linking verb: ${input}`, () => {
      expect(sanitize(input).text).toBe(expected);
    });
  }
  it('still recognizes Slavic name pairs', () => {
    for (const name of ['Ivan Petrov', 'Анна Иванова']) {
      expect(sanitize(`${name} called`).text).toBe('[REDACTED] called');
    }
  });
});

describe('identifier validators (#128)', () => {
  for (const [check, valid, invalid] of [
    [checks.abaRouting, '121000358', '121000359'],
    [checks.spanishNie, 'X1234567L', 'X1234567M'],
    [checks.abn, '51 824 753 556', '51 824 753 557'],
    [checks.acn, '005 499 981', '005 499 982'],
    [checks.medicare, '2123 45670 1', '2123 45671 1'],
    [checks.aadhaar, '2345 6789 0124', '2345 6789 0125'],
    [checks.gstin, '27AAPFU0939F1ZV', '27AAPFU0939F1ZW'],
    [checks.finnishIdentityCode, '131052-308T', '131052-308U'],
    [checks.thaiId, '1101700207030', '1101700207031'],
    [checks.dea, 'BB1388568', 'BB1388569'],
    [checks.swiftCode, 'DEUTDEFF', 'TRANSFER'],
  ]) {
    it(`${check.name} accepts ${valid} and rejects ${invalid}`, () => {
      expect(check(valid)).toBe(true);
      expect(check(invalid)).toBe(false);
    });
  }
  it('exposes the national rule table for reuse and extension', () => {
    expect(nationalRules.some((rule) => rule.type === 'IN_AADHAAR')).toBe(true);
    const custom = [
      ...nationalRules,
      {
        type: 'EXAMPLE_MEMBER_ID',
        pattern: /M-\d{6}/g,
        context: /\bmember\b/i,
        checksum: () => false,
      },
    ];
    expect(custom.length).toBe(nationalRules.length + 1);
  });
});

describe('checksum-valid fakes for new identifiers (#128)', () => {
  const key = 'private-fixture-key-at-least-16-bytes';
  for (const [type, value, check] of [
    ['ABA_ROUTING_NUMBER', '121000358', checks.abaRouting],
    ['ES_NIE', 'X1234567L', checks.spanishNie],
    ['IT_VAT_CODE', '07643520567', checks.shortLuhn],
    ['AU_ACN', '005499981', checks.acn],
    ['IN_AADHAAR', '234567890124', checks.aadhaar],
    ['TH_TNIN', '1101700207030', checks.thaiId],
    ['MEDICAL_LICENSE', 'BB1388568', checks.dea],
    ['IMEI', '490154203237518', checks.shortLuhn],
  ]) {
    it(`keeps ${type} fakes valid and different`, () => {
      const output = redact(
        value,
        [
          {
            start: 0,
            end: value.length,
            type,
            category: 'personal',
            rule: 'fixture',
          },
        ],
        { transformation: { mode: 'fake', key } }
      );
      expect(output).not.toBe(value);
      expect(output.length).toBe(value.length);
      expect(check(output)).toBe(true);
    });
  }
});

describe('custom identifier rules through the Detector port (#128)', () => {
  const memberRule = {
    type: 'EXAMPLE_MEMBER_ID',
    pattern: /M-\d{6}/g,
    context: /\bmember\b/i,
    checksum: () => false,
  };
  it('redacts a caller-defined identifier with the built-in confidence model', () => {
    const detector = createIdentifierDetector([memberRule]);
    const result = sanitize('member M-123456 joined; ref M-654321', {
      detectors: [detector],
    });
    expect(result.text).toBe('member [REDACTED] joined; ref [REDACTED]');
    expect(detector.detect('M-123456')).toEqual([]);
  });
  it('can reuse built-in validators in a custom rule', () => {
    const detector = createIdentifierDetector([
      {
        ...memberRule,
        type: 'EXAMPLE_LUHN_ID',
        pattern: /\d{11}/g,
        checksum: identifierChecks.shortLuhn,
        valid: identifierChecks.shortLuhn,
      },
    ]);
    expect(detector.detect('id 79927398713').length).toBe(1);
    expect(detector.detect('id 79927398714').length).toBe(0);
  });
  for (const rules of [
    [],
    [{ ...memberRule, pattern: /M-\d{6}/ }],
    [{ ...memberRule, context: /member/g }],
    [{ ...memberRule, type: 'lower' }],
    [{ ...memberRule, valid: 'yes' }],
  ]) {
    it('rejects malformed identifier rules with ERR_CONFIG', () => {
      let error;
      try {
        createIdentifierDetector(rules);
      } catch (caught) {
        error = caught;
      }
      expect(error?.code).toBe('ERR_CONFIG');
    });
  }
});
