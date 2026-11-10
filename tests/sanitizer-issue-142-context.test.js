import { describe, it, expect } from 'test-anywhere';
import { Buffer } from 'node:buffer';
import {
  sanitize,
  createSanitizer,
  createSyncSanitizer,
} from '../src/index.js';

// Synthetic values, assembled at run time so secret scanners skip the source.
const GH = ['ghp_', 'Zx9Qw7Er5Ty3Ui1Op0As', '2Df4Gh6Jk8Lz0Xc2Vb4N'].join('');
const OPAQUE = ['f3a9', 'c2e1b7d4', '9a0e6f12', 'c4b8d3e5'].join('');
const HIVE = {
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
};
const hive = (text, options = {}) =>
  createSyncSanitizer({ ...HIVE, ...options }).sanitize(text).text;
const redact = (text) => sanitize(text, { credentialsOnly: true }).text;

describe('Authorization schemes stay readable (issue 131)', () => {
  it('masks only the credential after a scheme word', async () => {
    expect(hive(`Authorization: token ${GH}`)).toBe(
      'Authorization: token ghp…b4N'
    );
    expect(hive(`Authorization: CustomScheme ${OPAQUE}`)).toBe(
      'Authorization: CustomScheme f3a…3e5'
    );
    expect(hive(`{"Authorization":"token ${GH}"}`)).toBe(
      '{"Authorization":"token ghp…b4N"}'
    );
    for (const header of ['Authorization', 'Proxy-Authorization']) {
      const input = `${header}: Bearer ${OPAQUE} tail`;
      const expected = `${header}: Bearer [REDACTED] tail`;
      expect(redact(input)).toBe(expected);
      expect(
        (await createSanitizer({ credentialsOnly: true }).sanitize(input)).text
      ).toBe(expected);
    }
  });
  it('keeps Digest, OAuth and SigV4 parameter names and public parameters', () => {
    expect(
      hive(
        `Authorization: Digest username="alice", realm="api", nonce="${OPAQUE}", response="${OPAQUE}"`
      )
    ).toBe(
      'Authorization: Digest username="alice", realm="api", nonce="f3a…3e5", response="f3a…3e5"'
    );
    expect(
      redact(
        `Authorization: Digest username="alice", realm="api", uri="/x", qop=auth, nc=00000001, cnonce="${OPAQUE}", response="${OPAQUE}", opaque="${OPAQUE}"`
      )
    ).toBe(
      'Authorization: Digest username="alice", realm="api", uri="/x", qop=auth, nc=00000001, cnonce="[REDACTED]", response="[REDACTED]", opaque="[REDACTED]"'
    );
    expect(
      redact(
        `Authorization: OAuth oauth_consumer_key="${OPAQUE}", oauth_signature="${OPAQUE}", oauth_version="1.0"`
      )
    ).toBe(
      'Authorization: OAuth oauth_consumer_key="[REDACTED]", oauth_signature="[REDACTED]", oauth_version="1.0"'
    );
    const signature = OPAQUE.repeat(2);
    expect(
      redact(
        `Authorization: AWS4-HMAC-SHA256 Credential=${OPAQUE}/20240101/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=${signature}`
      )
    ).toBe(
      'Authorization: AWS4-HMAC-SHA256 Credential=[REDACTED], SignedHeaders=host;x-amz-date, Signature=[REDACTED]'
    );
  });
  it('treats a single token68 credential as one value', () => {
    const basic = Buffer.from(`user:${OPAQUE}`).toString('base64');
    expect(redact(`Authorization: Basic ${basic}`)).toBe(
      'Authorization: Basic [REDACTED]'
    );
  });
});

describe('format context stays readable (issue 132)', () => {
  it('keeps URL schemes, hosts and user names', () => {
    expect(hive(`https://alice:${OPAQUE}@example.com/repo.git`)).toBe(
      'https://alice:f3a…3e5@example.com/repo.git'
    );
    expect(hive(`https://x-access-token:${GH}@github.com/o/r.git`)).toBe(
      'https://x-access-token:ghp…b4N@github.com/o/r.git'
    );
    // Outside credentialsOnly the user name is still personal data.
    expect(
      createSyncSanitizer({ transformation: { mode: 'hive-mask' } }).sanitize(
        `https://alice:${OPAQUE}@example.com/repo.git`
      ).text
    ).toBe('https://[REDACTED]:f3a…3e5@example.com/repo.git');
    expect(
      hive(
        `https://hooks.slack.com/services/T00000000/B00000000/${OPAQUE.slice(0, 24)}`
      )
    ).toBe('https://hooks.slack.com/services/T00…4b8');
  });
  it('keeps cookie names, separators and attributes', () => {
    expect(hive(`Cookie: session=${OPAQUE}; csrftoken=${OPAQUE}`)).toBe(
      'Cookie: session=f3a…3e5; csrftoken=f3a…3e5'
    );
    expect(hive(`Set-Cookie: id=${OPAQUE}; Path=/; HttpOnly; Secure`)).toBe(
      'Set-Cookie: id=f3a…3e5; Path=/; HttpOnly; Secure'
    );
    expect(hive(`{"Cookie": "a=${OPAQUE}; b=${OPAQUE}"}`)).toBe(
      '{"Cookie": "a=f3a…3e5; b=f3a…3e5"}'
    );
  });
  it('keeps PEM armor and the text between blocks', () => {
    const body = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC';
    const input = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\nbetween line stays\n-----BEGIN PRIVATE KEY-----\n${body.repeat(3)}\n-----END PRIVATE KEY-----`;
    expect(redact(input)).toBe(
      '-----BEGIN PRIVATE KEY-----\n[REDACTED]\n-----END PRIVATE KEY-----\nbetween line stays\n-----BEGIN PRIVATE KEY-----\n[REDACTED]\n-----END PRIVATE KEY-----'
    );
    // Armor words are not a person name outside credentialsOnly either.
    expect(
      sanitize(
        `-----BEGIN RSA PRIVATE KEY-----\n${body}\n-----END RSA PRIVATE KEY-----`
      ).text
    ).toBe(
      '-----BEGIN RSA PRIVATE KEY-----\n[REDACTED]\n-----END RSA PRIVATE KEY-----'
    );
  });
  it('ends a line context value where a vendor token ends', () => {
    expect(hive(`User token: ${GH}. Next sentence stays`)).toBe(
      'User token: ghp…b4N. Next sentence stays'
    );
  });
});

describe('masked output is stable (issue 133)', () => {
  it('leaves its own hive-mask output unchanged on a second pass', () => {
    const encoded = Buffer.from(
      JSON.stringify({ access_token: GH, scope: 'repo' })
    ).toString('base64');
    const once = hive(`body ${encoded} end`);
    expect(once).not.toBe(`body ${encoded} end`);
    expect(hive(once)).toBe(once);
    for (const text of [
      `token: ${GH}`,
      `Authorization: Bearer ${OPAQUE}`,
      `https://alice:${OPAQUE}@example.com`,
      `Cookie: session=${OPAQUE}`,
    ]) {
      const first = hive(text);
      expect(hive(first)).toBe(first);
    }
  });
  it('leaves masks of other tools unchanged', () => {
    for (const text of [
      'docker run --env TOKEN_SECRET=*** image',
      'password: ***',
      'token: ghp…b4N',
      'token: ab***yz',
    ]) {
      expect(hive(text)).toBe(text);
    }
  });
});
