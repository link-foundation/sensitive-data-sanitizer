import { describe, it, expect } from 'test-anywhere';
import { resolve } from 'node:path';
import {
  createSanitizer,
  createWikidataVerifier,
  sanitizePayload,
  createSentryBeforeSend,
  createOutboundSanitizer,
  knownSecretsFromGitHubAuth,
} from '../src/index.js';
describe('explicit public verification and outbound helpers', () => {
  it('verifies public candidates with source evidence and never queries credentials or private namesakes', async () => {
    const queries = [];
    const verifyPublic = createWikidataVerifier({
      fetch: async (url) => {
        queries.push(url.searchParams.get('search'));
        return {
          ok: true,
          json: async () => ({
            search: [
              {
                label: 'John Smith',
                id: 'Q123',
                description: 'English writer',
              },
            ],
          }),
        };
      },
    });
    const engine = createSanitizer({ verifyPublic });
    expect((await engine.sanitize('John Smith')).text).toBe('John Smith');
    expect(
      (await engine.sanitize('patient: John Smith\npassword: John Smith')).text
    ).toBe('patient: [REDACTED]\npassword: [REDACTED]');
    expect(queries.length).toBe(1);
  });
  it('blocks publication on required verification errors', async () => {
    let blocked = false;
    try {
      await createSanitizer({
        verifyPublic: async () => {
          throw new Error('private diagnostics');
        },
      }).sanitize('John Smith');
    } catch (e) {
      blocked = e.code === 'ERR_PUBLIC_VERIFICATION';
    }
    expect(blocked).toBe(true);
  });
  it('keeps explicit private names ahead of manual and online public exemptions', async () => {
    let queried = false;
    const engine = createSanitizer({
      knownPersonal: [{ type: 'PERSON', value: 'John Smith' }],
      publicEntities: [
        {
          type: 'PERSON',
          value: 'John Smith',
          source: 'https://www.wikidata.org/wiki/Q123',
          reviewedAt: '2026-10-07',
        },
      ],
      verifyPublic: async () => {
        queried = true;
        return undefined;
      },
    });
    expect((await engine.sanitize('John Smith')).text).toBe('[REDACTED]');
    expect(queried).toBe(false);
  });
  it('sanitizes contextual JSON and drops failed Sentry events', async () => {
    const payload = {
      password: 'a"b',
      user: { email: 'alice@unknown.example' },
      message: 'Call John Smith',
    };
    const result = await sanitizePayload(payload);
    expect(result.password).toBe('[REDACTED]');
    expect(result.user.email).toBe('[REDACTED]');
    expect((await createSentryBeforeSend()(payload)).message).toBe(
      'Call [REDACTED]'
    );
    const failing = {
      sanitizer: {
        sanitize: async () => {
          throw new Error();
        },
      },
    };
    expect(await createSentryBeforeSend(failing)(payload)).toBe(null);
    let called = false;
    try {
      await createOutboundSanitizer(() => {
        called = true;
      }, failing)(payload);
    } catch {
      /* Publication was blocked. */
    }
    expect(called).toBe(false);
  });
  it('loads gh auth only on an explicit invocation and hides subprocess errors', async () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    let blocked = false;
    try {
      await knownSecretsFromGitHubAuth({ command: '/no/such/synthetic-gh' });
    } catch (e) {
      blocked = e.code === 'ERR_AUTH';
    }
    expect(blocked).toBe(true);
  });
  it('detects the exact synthetic value returned by local auth', async () => {
    if (typeof Deno !== 'undefined' || process.platform === 'win32') {
      return;
    }
    const knownSecrets = await knownSecretsFromGitHubAuth({
      command: resolve('experiments/mock-gh-auth.mjs'),
      hostname: 'github.com',
    });
    expect(
      (
        await createSanitizer({ knownSecrets }).sanitize(
          'Value: synthetic-local-auth-fixture'
        )
      ).text
    ).toBe('Value: [REDACTED]');
  });
});
