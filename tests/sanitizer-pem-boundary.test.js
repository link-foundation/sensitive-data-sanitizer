import { describe, it, expect } from 'test-anywhere';
import { createSanitizer, createSyncSanitizer } from '../src/index.js';
const cases = [
  [
    '-----BEGIN PRIVATE KEY-----this is not a private key-----END PRIVATE KEY-----',
    '-----BEGIN PRIVATE KEY-----[REDACTED]-----END PRIVATE KEY-----',
  ],
  [
    '<pre>-----BEGIN RSA PRIVATE KEY-----<br>MIIEpAIBAAKCAQEA04up8h<br>-----END RSA PRIVATE KEY-----</pre>',
    '<pre>-----BEGIN RSA PRIVATE KEY-----[REDACTED]-----END RSA PRIVATE KEY-----</pre>',
  ],
];
describe('adjacent PEM armor and replacement boundaries', () => {
  it('publishes same-line and HTML-wrapped blocks idempotently', async () => {
    for (const engine of [
      createSyncSanitizer(),
      createSanitizer({ secretlint: false }),
    ]) {
      for (const [input, expected] of cases) {
        const result = await engine.sanitize(input);
        expect(result.text).toBe(expected);
        expect((await engine.sanitize(result.text)).text).toBe(expected);
      }
    }
  });
  it('still redacts literal material glued to a mask inside the body', () => {
    const input =
      '-----BEGIN PRIVATE KEY-----[REDACTED]literal-material-----END PRIVATE KEY-----';
    expect(createSyncSanitizer().sanitize(input).text).not.toContain(
      'literal-material'
    );
  });
});
