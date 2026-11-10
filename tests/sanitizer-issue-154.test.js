import { describe, it, expect } from 'test-anywhere';
import * as credentials from '../src/credentials-entry.js';
import * as full from '../src/index.js';

const body = 'SYNTHETIC_PRIVATE_KEY_MATERIAL_123456';
const options = {
  credentialsOnly: true,
  transformation: { mode: 'hive-mask' },
  transformations: { PRIVATE_KEY: { mode: 'redact' } },
};
const pem = (label, newline = '\n') =>
  [`-----BEGIN ${label}-----`, body, `-----END ${label}-----`].join(newline);
const putty = (version) =>
  [
    `PuTTY-User-Key-File-${version}: ssh-ed25519`,
    'Encryption: none',
    'Comment: synthetic fixture',
    'Public-Lines: 1',
    'QUJD',
    'Private-Lines: 1',
    'REVGRw==',
    `Private-MAC: ${'ab'.repeat(32)}`,
  ].join('\n');
const cases = [
  ...[
    'PRIVATE KEY',
    'RSA PRIVATE KEY',
    'EC PRIVATE KEY',
    'DSA PRIVATE KEY',
    'OPENSSH PRIVATE KEY',
    'ENCRYPTED PRIVATE KEY',
  ].map((label) => [
    label,
    pem(label),
    pem(label).replace(body, '[REDACTED]'),
    'private-key',
  ]),
  ...['\r\n', '\\n'].map((newline) => [
    `PEM with ${JSON.stringify(newline)}`,
    pem('PRIVATE KEY', newline),
    pem('PRIVATE KEY', newline).replace(body, '[REDACTED]'),
    'private-key',
  ]),
  ...[2, 3].map((version) => [
    `PuTTY v${version}`,
    putty(version),
    '[REDACTED]',
    'putty-private-key',
  ]),
];

describe('private-key type overrides (#154)', () => {
  it('reserves the native private-key placeholder namespace', () => {
    expect(credentials.reservedPlaceholderTypes().includes('PRIVATE_KEY')).toBe(
      true
    );
    expect(credentials.isPlaceholderToken('PrivateKey-1')).toBe(true);
  });
  for (const [name, key, replacement, rule] of cases) {
    it(`fully redacts ${name} through both sync entries and the async engine`, async () => {
      const input = `before\n${key}\nafter\npassword: ordinary-secret-value`;
      const expected = `before\n${replacement}\nafter\npassword: ord…lue`;
      for (const entry of [credentials, full]) {
        const sync = entry.createSyncSanitizer(options);
        const findings = sync.inspect(input).filter((f) => f.rule === rule);
        expect(findings.length > 0).toBe(true);
        expect(
          findings.every(
            (f) => f.type === 'PRIVATE_KEY' && f.category === 'credential'
          )
        ).toBe(true);
        expect(sync.sanitize(input).text).toBe(expected);
        expect(entry.sanitize(input, options).text).toBe(expected);
      }
      const engine = credentials.createSanitizer(options);
      expect((await engine.sanitize(input)).text).toBe(expected);
    });
  }

  it('preserves default redaction and explicit private-key hive masking', () => {
    const input = pem('PRIVATE KEY');
    expect(credentials.sanitize(input).text).toBe(
      input.replace(body, '[REDACTED]')
    );
    expect(
      credentials.sanitize(input, {
        transformations: { PRIVATE_KEY: { mode: 'hive-mask' } },
      }).text
    ).toBe(input.replace(body, 'SYN…456'));
  });

  it('fully redacts an unterminated PEM body', () => {
    const input = `before\n-----BEGIN PRIVATE KEY-----\n${body}`;
    expect(credentials.sanitize(input, options).text).toBe(
      input.replace(body, '[REDACTED]')
    );
  });

  it('applies the override to decoded payloads and structured JSON strings', () => {
    const input = pem('PRIVATE KEY');
    const expected = input.replace(body, '[REDACTED]');
    const encoded = Buffer.from(input).toString('base64');
    expect(
      credentials.sanitize(encoded, { ...options, preserveEncoding: true }).text
    ).toBe(Buffer.from(expected).toString('base64'));
    expect(
      credentials.sanitize(JSON.stringify({ log: input }), {
        ...options,
        structured: 'json',
      }).text
    ).toBe(JSON.stringify({ log: expected }));
  });

  it('applies the override across small stream chunks', async () => {
    for (const [key, replacement] of [
      [pem('PRIVATE KEY'), pem('PRIVATE KEY').replace(body, '[REDACTED]')],
      [putty(3), '[REDACTED]'],
    ]) {
      const output = [];
      for await (const chunk of full.sanitizeStream(
        Array.from(`before\n${key}\nafter`),
        {
          ...options,
          batchBytes: 8,
        }
      )) {
        output.push(chunk);
      }
      expect(output.join('')).toBe(`before\n${replacement}\nafter`);
    }
  });
});
