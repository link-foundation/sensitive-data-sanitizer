import { describe, it, expect } from 'test-anywhere';
import {
  inspect,
  sanitize,
  createSanitizer,
  sanitizeStream,
} from '../src/index.js';

const secret = 'Zq8vR2mT9xLp';
const putty = [
  'PuTTY-User-Key-File-3: ssh-ed25519',
  'Encryption: none',
  'Comment: fixture',
  'Public-Lines: 1',
  'QUJD',
  'Private-Lines: 1',
  'REVGRw==',
  `Private-MAC: ${'ab'.repeat(32)}`,
].join('\n');
describe('native credential format regressions (#10)', () => {
  for (const input of [
    `machine api.example.net login alice password ${secret}`,
    `machine api.example.net\n login alice\n password ${secret}`,
    `default login alice password ${secret}`,
  ]) {
    it('redacts the complete netrc credential triplet', () => {
      expect(sanitize(input).text).toBe('[REDACTED]');
      expect(inspect(input).some((f) => f.rule === 'netrc')).toBe(true);
    });
  }
  it('detects NuGet keys without a path-specific rule', async () => {
    const value = `oy2${'abc19xyz8'.repeat(5).slice(0, 43)}`;
    expect(sanitize(value).text).toBe('[REDACTED]');
    expect((await createSanitizer().sanitize(value)).text).toBe('[REDACTED]');
  });
  for (const prefix of ['AUTH', 'SECURE_AUTH', 'LOGGED_IN', 'NONCE']) {
    for (const suffix of ['KEY', 'SALT']) {
      it(`redacts the complete WordPress ${prefix}_${suffix} value`, () => {
        const input = `define('${prefix}_${suffix}', '${secret}#@!');`;
        expect(sanitize(input).text).toBe(
          `define('${prefix}_${suffix}', '[REDACTED]');`
        );
      });
    }
  }
  it('redacts the entire PuTTY v3 private block', () => {
    expect(sanitize(`before\n${putty}\nafter`).text).toBe(
      'before\n[REDACTED]\nafter'
    );
  });
  it('holds multiline credentials across stream batches and source chunks', async () => {
    for (const input of [
      putty,
      `machine api.example.net\nlogin alice\npassword ${secret}`,
    ]) {
      const output = [];
      for await (const chunk of sanitizeStream(Array.from(input), {
        batchBytes: 8,
        secretlint: false,
      })) {
        output.push(chunk);
      }
      expect(output.join('')).toBe('[REDACTED]');
    }
  });
  it('handles WordPress phrases containing opposite quotes and escape sequences', () => {
    const input = `define('AUTH_KEY', 'a"b\\'c-opaque-fixture');`;
    expect(sanitize(input).text).toBe("define('AUTH_KEY', '[REDACTED]');");
  });
  it('keeps placeholders, empty values and public example domains', () => {
    for (const input of [
      'machine example.com login alice password ${PASS}',
      "define('DB_PASSWORD', '');",
      "define('AUTH_KEY', '${AUTH_KEY}');",
      'example.com',
    ]) {
      expect(sanitize(input).text).toBe(input);
    }
    expect(
      sanitize('password: ${PASS}', { knownSecrets: ['${PASS}'] }).text
    ).toBe('password: [REDACTED]');
  });
});
