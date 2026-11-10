import { describe, it, expect } from 'test-anywhere';
import {
  createSyncSanitizer,
  createSanitizer,
  inspect,
} from '../src/credentials-entry.js';
import { refineCredentialSpans } from '../src/credential-spans.js';

const scheme = 'SharedAccessSignature';
const payload = [
  'sr=namespace&sig=',
  'abcdefghijklmnopqrstuvwxyz',
  '123456&se=123456',
].join('');
const options = {
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
};
const sanitizer = createSyncSanitizer(options);

describe('overlapping Authorization findings (issue 152)', () => {
  for (const header of [
    'Authorization',
    'Proxy-Authorization',
    'aUtHoRiZaTiOn',
  ]) {
    for (const wrap of [
      (value) => `${header}: ${value}`,
      (value) => `curl -H "${header}: ${value}" after`,
      (value) => JSON.stringify({ [header]: value }),
      (value) => JSON.stringify(JSON.stringify({ [header]: value })),
    ]) {
      const input = wrap(`${scheme} ${payload}`);
      it(`preserves the scheme in ${wrap('value')}`, async () => {
        const expected = wrap(`${scheme} sr=…456`);
        expect(sanitizer.sanitize(input).text).toBe(expected);
        expect(sanitizer.sanitize(expected).text).toBe(expected);
        expect((await createSanitizer(options).sanitize(input)).text).toBe(
          expected
        );
        expect(createSyncSanitizer().sanitize(input).text).toBe(
          wrap(`${scheme} [REDACTED]`)
        );
        const start = input.indexOf(scheme);
        expect(
          inspect(input, options).some(
            (finding) =>
              finding.start === start && finding.end === start + scheme.length
          )
        ).toBe(false);
      });
    }
  }

  it('keeps bare credentials and credentials without a separate payload masked', () => {
    for (const suffix of ['', ' ', '\t', '\n', ' \n', ' "', ' \\"', ' }']) {
      const input = `Authorization: ${scheme}${suffix}`;
      expect(sanitizer.sanitize(input).text).not.toContain(scheme);
    }
    expect(sanitizer.sanitize(`Authorization: Bearer ${scheme}`).text).toBe(
      'Authorization: Bearer Sha…ure'
    );
  });

  it('keeps exact known secrets authoritative in scheme and payload positions', () => {
    const known = createSyncSanitizer({ ...options, knownSecrets: [scheme] });
    expect(known.sanitize(`Authorization: ${scheme} ${payload}`).text).toBe(
      'Authorization: Sha…ure sr=…456'
    );
    expect(known.sanitize(`Authorization: Bearer ${scheme}`).text).toBe(
      'Authorization: Bearer Sha…ure'
    );
  });

  it('exempts only an exact scheme span, never overlapping or payload spans', () => {
    const text = `Authorization: ${scheme} ${payload}`;
    const start = text.indexOf(scheme);
    const end = start + scheme.length;
    const finding = {
      start,
      end,
      rule: 'gitleaks/generic-api-key',
      category: 'credential',
      type: 'SECRET',
    };
    expect(refineCredentialSpans(text, [finding])).toEqual([]);
    for (const other of [
      { ...finding, start: start + 1 },
      { ...finding, end: end + 1 },
      { ...finding, start: end + 1, end: text.length },
      { ...finding, rule: 'known-secret' },
    ]) {
      expect(refineCredentialSpans(text, [other])).toEqual([other]);
    }
    const unrelated = `X-Authorization: ${scheme} ${payload}`;
    const offset = unrelated.indexOf(scheme);
    const other = { ...finding, start: offset, end: offset + scheme.length };
    expect(refineCredentialSpans(unrelated, [other])).toEqual([other]);
  });

  it('handles multiple headers without exempting a bare credential elsewhere', () => {
    const input = `Authorization: ${scheme} ${payload}\nAuthorization: ${scheme}`;
    expect(sanitizer.sanitize(input).text).toBe(
      `Authorization: ${scheme} sr=…456\nAuthorization: Sha…ure`
    );
  });
});
