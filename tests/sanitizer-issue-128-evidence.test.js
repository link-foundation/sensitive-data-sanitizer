import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { URL } from 'node:url';
import { describe, it, expect } from 'test-anywhere';
import { sanitize, inspect, redact, builtInRules } from '../src/index.js';
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
  // Closed-source documentation cases (Google SDP, Lakera, Sentry Relay)
  ['call 1-206-867-5309', 'call [REDACTED]'],
  ['SSN 030 72 7381', 'SSN [REDACTED]'],
  ['social security number: 003 06-8815', 'social security number: [REDACTED]'],
  ['IBAN CH 9300762011623852957', 'IBAN [REDACTED]'],
  ['Contact John C Smith today', 'Contact [REDACTED] today'],
  [
    'C:\\Windows\\Profiles\\Armin\\Temp',
    'C:\\Windows\\Profiles\\[REDACTED]\\Temp',
  ],
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
  'v1-206-867-5309',
  'Will I Go',
  'GET https://api.example.com/users/42',
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

// Secret forms from Betterleaks/Gitleaks, Kingfisher, detect-secrets and LLM
// Guard fixtures. Tokens are assembled at runtime so no literal provider
// credential is committed.
const token = ['gh', 'p_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'].join('');
const hash = [
  '$',
  '2y$10$',
  'N9qo8uLOickgx2ZMRZoMye',
  'IjZAgcfl7p92ldGxad68LJZdL17lhWy',
].join('');
const secretForms = [
  ['clientSecret = "abcdefgh123"', 'clientSecret = "[REDACTED]"'],
  ["secretKey: 'wJalrXUtnFEMIbPxRfiCY'", "secretKey: '[REDACTED]'"],
  ['const dbPassword = "hunter22";', 'const dbPassword = [REDACTED];'],
  ['ClientSecret = "abc123xyz"', 'ClientSecret = "[REDACTED]"'],
  ['userpass=hunter22', 'userpass=[REDACTED]'],
  ['bindpw: s3cr3tpw', 'bindpw: [REDACTED]'],
  [
    'curl --tlspassword s3cr3tpw https://example.com',
    'curl --tlspassword [REDACTED] https://example.com',
  ],
  [
    'curl --proxy-user admin:s3cr3tpw https://example.com',
    'curl --proxy-user [REDACTED] https://example.com',
  ],
  [
    '{"name":"DB_PASSWORD","value":"hunter2"}',
    '{"name":"DB_PASSWORD","value":"[REDACTED]"}',
  ],
  [
    '- name: DB_PASSWORD\n  value: hunter2',
    '- name: DB_PASSWORD\n  value: [REDACTED]',
  ],
  ['smtp.login(username, "hunter2")', 'smtp.login(username, "[REDACTED]")'],
  ["ftp.login('anna', 'pw12')", "ftp.login('anna', '[REDACTED]')"],
  [`admin:${hash}`, 'admin:[REDACTED]'],
];
const secretKept = [
  "tokenType: 'bearer'",
  "secretName: 'db-creds'",
  'maxTokens: 100',
  'showPassword: false',
  'clientSecret: config.clientSecret,',
  '  apiToken: string;',
  '{ csrfToken: req.csrfToken() }',
  'bypass=1',
  'login(user, "")',
  'printf("%u items", n)',
];
const escaped = (map) => [...token].map(map).join('');
const hex = (c) => c.charCodeAt(0).toString(16).padStart(4, '0');

describe('competitor secret forms (#128)', () => {
  for (const [input, expected] of secretForms) {
    it(`redacts ${JSON.stringify(input)}`, () => {
      expect(sanitize(input).text).toBe(expected);
    });
  }
  for (const input of secretKept) {
    it(`keeps ${JSON.stringify(input)}`, () => {
      expect(sanitize(input).text).toBe(input);
    });
  }
  for (const [name, input] of [
    ['\\u{…} escapes', escaped((c) => `\\u{${hex(c)}}`)],
    ['%u escapes', escaped((c) => `%u${hex(c)}`)],
    ['\\U escapes', escaped((c) => `\\U0000${hex(c)}`)],
    ['soft hyphens', `key ${[...token].join('­')}`],
    ['zero-width spaces', `key ${[...token].join('​')}`],
  ]) {
    it(`finds a token hidden with ${name}`, () => {
      const text = sanitize(input).text;
      expect(text.includes('[REDACTED]')).toBe(true);
      expect(text.includes(token)).toBe(false);
      expect(text.includes(input)).toBe(false);
    });
  }
});

describe('rule ids for competitor evidence (#128)', () => {
  const ids = [
    'card-context',
    'credential-pair',
    'honorific-name',
    'login-call',
    'mail-display-name',
    'named-value',
    'password-hash',
    'po-box',
    'postal-label',
    'salutation',
    'self-introduction',
    'sign-off',
    'ssn-label',
    'state-zip',
  ];
  it('registers every new rule id for policy configuration', () => {
    expect(ids.filter((id) => !builtInRules.includes(id))).toEqual([]);
  });
  it('lets a personal evidence rule be switched off', () => {
    expect(
      sanitize('My name is Bond.', { rules: { 'self-introduction': false } })
        .text
    ).toBe('My name is Bond.');
  });
});

describe('evidence labels before long tab runs (#128)', () => {
  // CodeQL js/polynomial-redos: `[ \t]*X?[ \t]*` was quadratic in the tab run
  // (about 7 s for 60 000 tabs after SSN on Node); the rewritten form is
  // linear. Compare with the same text without a label so a slow runner, which
  // slows both scans alike, does not fail the test.
  const elapsed = (text) => {
    const start = performance.now();
    sanitize(text);
    return performance.now() - start;
  };
  const tabs = '\t'.repeat(60000);
  for (const label of ['P.O. Box', 'card no.', 'SSN', 'ZIP code']) {
    it(`scans ${label} followed by 60 000 tabs in linear time`, () => {
      const baseline = elapsed(`plain${tabs}x`);
      expect(elapsed(`${label}${tabs}x`)).toBeLessThan(3 * baseline + 1000);
    });
  }
});

// JavaScriptCore runs a regex in its interpreter when the JIT is unavailable or
// has given up, as happens late in a long `bun test` run. The interpreter tries
// a lookbehind at every position, so `(?<=,[ \t]*)` or `(?<!\d[ \t]*)` scans
// the whole whitespace run each time: about 10 s for 60 000 tabs. Lookbehinds
// that follow a literal ("Ms(?<!\d[ \t]*Ms)") run only where it matched.
// Quadrupling the run measured 11-13x before the rewrite and 3-4x after.
describe('lookbehinds stay linear in the JavaScriptCore interpreter (#128)', () => {
  const bun = globalThis.process?.versions?.bun;
  const script = `
    const { sanitize } = await import(${JSON.stringify(
      new URL('../src/index.js', import.meta.url).href
    )});
    const time = (text) => {
      const start = performance.now();
      sanitize(text);
      return performance.now() - start;
    };
    const ratios = {};
    for (const prefix of ['30', 'a,', 'Dear Ms']) {
      const short = time(prefix + '\\t'.repeat(4000) + 'x');
      ratios[prefix] = time(prefix + '\\t'.repeat(16000) + 'x') / short;
    }
    console.log(JSON.stringify(ratios));
  `;
  it('grows about fourfold, not sixteenfold, for a four times longer tab run', () => {
    if (!bun) {
      return;
    }
    const run = spawnSync(globalThis.process.execPath, ['-e', script], {
      encoding: 'utf8',
      env: { ...globalThis.process.env, BUN_JSC_useRegExpJIT: '0' },
      timeout: 25000,
    });
    expect(run.status).toBe(0);
    for (const ratio of Object.values(JSON.parse(run.stdout))) {
      expect(ratio).toBeLessThan(7);
    }
  });
});
