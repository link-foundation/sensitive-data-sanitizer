import { describe, it, expect } from 'test-anywhere';
import {
  createCredentialVerifier,
  credentialProviders,
  sanitize,
} from '../src/index.js';
const token = 'synthetic-test-value';
const candidate = { provider: 'github', token };
const response = (body, status = 200) =>
  new globalThis.Response(JSON.stringify(body), { status });
const bodies = {
  github: { id: 1 },
  gitlab: { id: 1, active: true, revoked: false },
  npm: { username: 'sample' },
  huggingface: { name: 'sample' },
  stripe: { object: 'balance' },
  openai: { object: 'list', data: [] },
  anthropic: { data: [], has_more: false },
  sendgrid: { scopes: [] },
  digitalocean: { account: { uuid: 'sample' } },
  notion: { object: 'user', id: 'sample' },
  discord: { id: '1', username: 'sample' },
  cloudflare: { success: true, result: { status: 'active' } },
};
describe('opt-in credential verification', () => {
  it('does no network work by default or for unsupported providers', async () => {
    let calls = 0;
    const fetch = async () => {
      calls++;
      throw new Error(token);
    };
    expect((await createCredentialVerifier({ fetch })(candidate)).status).toBe(
      'disabled'
    );
    const check = createCredentialVerifier({ enabled: true, fetch });
    expect((await check({ provider: 'unsupported', token })).status).toBe(
      'unsupported'
    );
    expect(calls).toBe(0);
  });
  it('checks every catalog entry using only its fixed endpoint and read-only method', async () => {
    for (const provider of credentialProviders) {
      let calls = 0;
      const check = createCredentialVerifier({
        enabled: true,
        fetch: async (url, init) => {
          calls++;
          expect(url).toBe(provider.endpoint);
          expect(url).not.toContain(token);
          expect(init.method).toBe('GET');
          expect(init.redirect).toBe('error');
          expect(
            Object.values(init.headers).some((v) => v.includes(token))
          ).toBe(true);
          const header =
            {
              gitlab: 'private-token',
              anthropic: 'x-api-key',
            }[provider.id] ?? 'Authorization';
          const expected =
            header !== 'Authorization'
              ? token
              : `${provider.id === 'discord' ? 'Bot' : 'Bearer'} ${token}`;
          expect(init.headers[header]).toBe(expected);
          expect(init.body).toBe(undefined);
          return response(bodies[provider.id]);
        },
      });
      expect(await check({ provider: provider.id, token })).toEqual({
        provider: provider.id,
        status: 'valid',
      });
      expect(calls).toBe(1);
    }
  });
  it('distinguishes rejected credentials from inconclusive responses without exposing bodies', async () => {
    for (const [status, expected] of [
      [401, 'invalid'],
      [403, 'unknown'],
      [429, 'unknown'],
      [500, 'unknown'],
      [302, 'unknown'],
    ]) {
      const check = createCredentialVerifier({
        enabled: true,
        fetch: async () => response({ error: token }, status),
      });
      const result = await check(candidate);
      expect(result.status).toBe(expected);
      expect(JSON.stringify(result)).not.toContain(token);
    }
    for (const body of [{}, { error: token }, [], null]) {
      const check = createCredentialVerifier({
        enabled: true,
        fetch: async () => response(body),
      });
      expect((await check(candidate)).status).toBe('unknown');
    }
  });
  it('bounds requests and responses and discards exception diagnostics', async () => {
    let calls = 0;
    const check = createCredentialVerifier({
      enabled: true,
      maxChecks: 1,
      fetch: async () => {
        calls++;
        throw new Error(token);
      },
    });
    expect(await check(candidate)).toEqual({
      provider: 'github',
      status: 'unknown',
      reason: 'request',
    });
    expect((await check(candidate)).reason).toBe('budget');
    expect(calls).toBe(1);
    const large = createCredentialVerifier({
      enabled: true,
      maxResponseBytes: 8,
      fetch: async () => response({ id: 1, private: token }),
    });
    expect((await large(candidate)).status).toBe('unknown');
  });
  it('aborts slow requests on the configured deadline', async () => {
    const check = createCredentialVerifier({
      enabled: true,
      timeoutMs: 10,
      fetch: (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('fallback')), 100);
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new Error(token));
            },
            { once: true }
          );
        }),
    });
    expect((await check(candidate)).status).toBe('unknown');
  });
});
describe('credential verification input and redaction contracts', () => {
  it('rejects invalid candidates and limits without making requests', async () => {
    let calls = 0;
    const check = createCredentialVerifier({
      enabled: true,
      fetch: async () => {
        calls++;
        return response({ id: 1 });
      },
    });
    for (const input of [
      null,
      undefined,
      {},
      { provider: 'github', token: '' },
      { provider: 'https://untrusted.example', token },
      { provider: 'github', token: 'line\nheader' },
      { provider: 'github', token: 'x'.repeat(16385) },
    ]) {
      let caught;
      try {
        await check(input);
      } catch (error) {
        caught = error;
      }
      expect(caught?.code).toBe('ERR_CONFIG');
      expect(caught?.message).not.toContain(token);
    }
    expect(calls).toBe(0);
    for (const options of [
      { timeoutMs: 0 },
      { maxChecks: -1 },
      { maxResponseBytes: 1.5 },
      { enabled: 'yes' },
      { fetch: null },
    ]) {
      let caught;
      try {
        createCredentialVerifier(options);
      } catch (error) {
        caught = error;
      }
      expect(caught?.code).toBe('ERR_CONFIG');
    }
  });
  it('never weakens redaction based on a verification outcome', async () => {
    const text = `password=${token}`;
    const before = sanitize(text).text;
    const check = createCredentialVerifier({
      enabled: true,
      fetch: async () => response({}, 401),
    });
    await check(candidate);
    expect(sanitize(text).text).toBe(before);
    expect(before).not.toContain(token);
  });
});
