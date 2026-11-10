import { describe, it, expect } from 'test-anywhere';
import { sanitize, inspect, redact } from '../src/index.js';
import * as checks from '../src/national-checks.js';
import { cryptoAddress } from '../src/crypto-addresses.js';

// Phrase-level and format cases taken from competitor test suites and
// documentation (Presidio, Scrubadub, LLM Guard, OpenRedaction, Google SDP,
// Azure, AWS). Every value is a published sample or a computed fake.
const redacted = [
  // Phrase evidence (src/personal-evidence.js)
  ['My name is Bond.', 'My name is [REDACTED].'],
  [
    'my name is Harry Potter and I live here',
    'my name is [REDACTED] and I live here',
  ],
  ['Dear Clifford,\n blah', 'Dear [REDACTED],\n blah'],
  ['blah blah. Thanks -Jon', 'blah blah. Thanks -[REDACTED]'],
  ['All the best,\n\n--Meg C.', 'All the best,\n\n--[REDACTED]'],
  ['Thank you ..Risemamy McCrubben', 'Thank you ..[REDACTED]'],
  [
    '# Contact: Bob Stone <bob.stone@example.com>',
    '# Contact: [REDACTED] <[REDACTED]>',
  ],
  ['login snoop pw biggreenhat', 'login [REDACTED] pw [REDACTED]'],
  ['u: snoop\np: biggreenhat', 'u: [REDACTED]\np: [REDACTED]'],
  ['john.doe[AT]protectai[DOT]com', '[REDACTED]'],
  ['write to john at gmail.com', 'write to [REDACTED]'],
  ['jane [at] host [dot] org', '[REDACTED]'],
  ['PO Box 123456', '[REDACTED]'],
  ['P.O. Box 77, Austin', '[REDACTED], Austin'],
  ['contact me on skype (dean.malmgren)', 'contact me on skype ([REDACTED])'],
  ['my card: 1234 5678 8765 4321.', 'my card: [REDACTED].'],
  ['Ship to ZIP 94105 today.', 'Ship to ZIP [REDACTED] today.'],
  ['ZIPs 10001 and 30301', 'ZIPs [REDACTED] and [REDACTED]'],
  ['New York City, NY 10002', 'New York City, NY [REDACTED]'],
  ['123 Main Street Apt 4B, Springfield', '[REDACTED]'],
  // Format coverage (cards, SSN, IBAN, MAC, dates, phones)
  ['Maestro 6759649826438453', 'Maestro [REDACTED]'],
  ['Dankort 5019717010103742', 'Dankort [REDACTED]'],
  ['SSN 078.05.1120 on file', 'SSN [REDACTED] on file'],
  ['IBAN AL47-2121-1009-0000-0002-3569-8741', 'IBAN [REDACTED]'],
  ['MAC 00-1B-63-84-45-E6.', 'MAC [REDACTED].'],
  ['switch 0019.b9f1.2a3c up', 'switch [REDACTED] up'],
  ['born 15th June 1991', 'born [REDACTED]'],
  ['DOB: March 3rd, 1990', 'DOB: [REDACTED]'],
  ['Desk: 5551234567', 'Desk: [REDACTED]'],
];
const kept = [
  'Dear Sir,\nhello',
  'Hi team,',
  'Thanks!',
  'Best Practices',
  'Hello World!',
  'Best,\nThe Support Team',
  'meet at example.com',
  'look at docs.python.org now',
  'user: alice pass the salt',
  'login form p tag',
  'version 2, CA 12345',
  'card games 12 cards',
  'took 30 Ms Retry',
  'machine example.com login alice password ${PASS}',
  'v1.078.05.1123',
  '123-45-6789-A',
  'Part number: 555-123-4567-A',
  'broadcast ff:ff:ff:ff:ff:ff',
  'mixed 00:1B-63:84-45:E6',
];

describe('competitor phrase and format cases (#128)', () => {
  for (const [input, expected] of redacted) {
    it(`redacts ${JSON.stringify(input)}`, () => {
      expect(sanitize(input).text).toBe(expected);
    });
  }
  for (const input of kept) {
    it(`keeps ${JSON.stringify(input)}`, () => {
      expect(sanitize(input).text).toBe(input);
    });
  }
  it('marks a username/password pair as account and credential', () => {
    const types = inspect('login snoop pw biggreenhat').map(
      (f) => `${f.type}:${f.category}`
    );
    expect(types.includes('USERNAME:personal')).toBe(true);
    expect(types.includes('SECRET:credential')).toBe(true);
  });
  it('is idempotent on its own output', () => {
    for (const [input] of redacted) {
      const once = sanitize(input).text;
      expect(sanitize(once).text).toBe(once);
    }
  });
});

const identifiers = [
  ['DE_TAX_ID', 'Steuer-ID 86095742719', '86095742719'],
  ['EU_VAT_NUMBER', 'USt-IdNr.: DE 136695976', 'DE 136695976'],
  ['EU_VAT_NUMBER', 'VAT: ATU13585627', 'ATU13585627'],
  ['AE_EMIRATES_ID', 'Emirates ID 784-1990-1234567-6', '784-1990-1234567-6'],
  ['SA_NATIONAL_ID', 'Iqama 2123456789', '2123456789'],
  ['IL_ID_NUMBER', 'Teudat Zehut 123456782', '123456782'],
  ['STEAM_ID', 'steam profile 76561197960287930', '76561197960287930'],
  ['TRACKING_NUMBER', 'UPS 1Z999AA10123456784', '1Z999AA10123456784'],
  ['CA_SIN', 'NAS 046 454 286', '046 454 286'],
];

describe('competitor national identifiers (#128)', () => {
  for (const [type, input, value] of identifiers) {
    it(`detects ${type} next to its label`, () => {
      expect(
        inspect(input).some(
          (f) => f.type === type && input.slice(f.start, f.end) === value
        )
      ).toBe(true);
      expect(sanitize(input).text.includes(value)).toBe(false);
    });
  }
  it('treats a checksum-valid UPS number as distinctive without a label', () => {
    expect(sanitize('ref 1Z999AA10123456784').text).toBe('ref [REDACTED]');
  });
});

describe('competitor checksum validators (#128)', () => {
  for (const [check, valid, invalid] of [
    [checks.germanTaxId, '86095742719', '86095742718'],
    [checks.germanVat, 'DE136695976', 'DE136695977'],
    [checks.upsTracking, '1Z999AA10123456784', '1Z999AA10123456785'],
    [checks.emiratesId, '784199012345676', '784199012345671'],
    [checks.saudiId, '1123456780', '1123456781'],
    [checks.israeliId, '123456782', '123456780'],
    [
      cryptoAddress,
      'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4',
      'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5',
    ],
    [
      cryptoAddress,
      '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
      '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN3',
    ],
  ]) {
    it(`${check.name} accepts ${valid} and rejects ${invalid}`, () => {
      expect(check(valid)).toBe(true);
      expect(check(invalid)).toBe(false);
    });
  }
});

describe('checksum-valid fakes for competitor identifiers (#128)', () => {
  const key = 'private-fixture-key-at-least-16-bytes';
  for (const [type, value, check] of [
    ['DE_TAX_ID', '86095742719', checks.germanTaxId],
    ['AE_EMIRATES_ID', '784199012345676', checks.emiratesId],
    ['SA_NATIONAL_ID', '1123456780', checks.saudiId],
    ['IL_ID_NUMBER', '123456782', checks.israeliId],
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
