import { describe, it, expect } from 'test-anywhere';
import {
  createSyncSanitizer,
  createSanitizer,
} from '../src/credentials-entry.js';

const options = {
  credentialsOnly: true,
  transformation: { mode: 'hive-mask' },
};
const input = 'const sessionToken = new SessionToken();';

describe('constructor assignments (issue 150)', () => {
  it('preserves constructor calls and reports no residual credentials', async () => {
    const sync = createSyncSanitizer(options);
    const asyncSanitizer = createSanitizer(options);
    for (const text of [
      input,
      'const apiToken = new auth.SessionToken();',
      'const password = new Password();',
      'const sessionToken = new\tSessionToken ();',
      'const sessionToken = new $SessionToken();',
      'const sessionToken = new SessionToken({ expires: 42 });',
      'const fileTokens = await getGitHubTokensFromFiles();',
      'secretlintDetections: null,',
      'password = None',
      'token: undefined',
      'maskSecrets: false,',
    ]) {
      expect(sync.sanitize(text).text).toBe(text);
      expect(sync.inspect(text)).toEqual([]);
      expect((await asyncSanitizer.sanitize(text)).text).toBe(text);
    }
  });

  it('still masks literal values and values beginning with a keyword', async () => {
    const sync = createSyncSanitizer(options);
    const asyncSanitizer = createSanitizer(options);
    for (const text of [
      'token=new-secret-0123456789',
      'token=new',
      'token="new"',
      'token="new SessionToken()"',
      'token=new-secret-0123456789 SessionToken()',
      'token=New SessionToken()',
      'token=new SessionToken',
      'api_key = falsehood-is-not-a-keyword',
      'SECRET=awaitingApproval42xyz',
    ]) {
      expect(sync.sanitize(text).text).not.toBe(text);
      expect((await asyncSanitizer.sanitize(text)).text).not.toBe(text);
    }
  });

  it('masks adjacent credentials without changing the constructor', () => {
    const text = `${input}\ntoken=new-secret-0123456789`;
    const result = createSyncSanitizer(options).sanitize(text).text;
    expect(result.startsWith(`${input}\ntoken=`)).toBe(true);
    expect(result).not.toContain('new-secret-0123456789');
  });

  it('never exempts an exact known secret, including with a caller hook', async () => {
    for (const secret of ['new', 'SessionToken']) {
      const configured = {
        ...options,
        knownSecrets: [secret],
        exempt: () => true,
      };
      const expected = input.replace(secret, '[REDACTED]');
      expect(createSyncSanitizer(configured).sanitize(input).text).toBe(
        expected
      );
      expect((await createSanitizer(configured).sanitize(input)).text).toBe(
        expected
      );
    }
  });
});
