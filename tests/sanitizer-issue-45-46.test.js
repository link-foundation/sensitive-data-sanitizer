import { describe, it, expect } from 'test-anywhere';
import {
  sanitize,
  inspect,
  createSanitizer,
  knownSecretsFromEnv,
} from '../src/index.js';

const token = 'ghx1234567890abcdefXYZ';
describe('Authorization boundaries (issue 45)', () => {
  for (const header of ['Authorization', 'Proxy-Authorization']) {
    for (const scheme of ['token', 'Bearer', 'Basic', 'Digest', 'Api-Token']) {
      for (const delimiter of [' ', '\t', "'", '"', '\\', ',']) {
        it(`bounds ${header} ${scheme} at ${JSON.stringify(delimiter)}`, async () => {
          const input = `${header}: ${scheme} ${token}${delimiter}keep-after`;
          const expected = `${header}: [REDACTED]${delimiter}keep-after`;
          expect(sanitize(input, { credentialsOnly: true }).text).toBe(
            expected
          );
          expect(
            (await createSanitizer({ credentialsOnly: true }).sanitize(input))
              .text
          ).toBe(expected);
          for (const finding of inspect(input, { credentialsOnly: true })) {
            expect(finding.end <= input.indexOf(token) + token.length).toBe(
              true
            );
          }
        });
      }
    }
  }
  it('retains curl quotes and JSON prompt suffixes across escape depths', async () => {
    for (const quote of ["'", '"']) {
      let input = `curl -H ${quote}Authorization: token ${token}${quote} keep-after`;
      let expected = `curl -H ${quote}Authorization: [REDACTED]${quote} keep-after`;
      for (let depth = 0; depth < 3; depth++) {
        expect(
          (await createSanitizer({ credentialsOnly: true }).sanitize(input))
            .text
        ).toBe(expected);
        input = JSON.stringify({ prompt: input });
        expected = JSON.stringify({ prompt: expected });
      }
    }
  });
});

describe('environment configuration selection (issue 46)', () => {
  it('excludes configuration names without filtering real credential values', () => {
    const config = {
      GIT_AUTH_TRANSPORT: 'github.com',
      HIVE_MIND_GIT_AUTH_TRANSPORT: 'github.com',
      SERVICE_AUTH_MODE: 'oauth',
      SERVICE_AUTH_METHOD: 'basic',
      SERVICE_AUTH_TYPE: 'bearer',
      AUTH_URL: 'https://login.example.com',
      AUTH_HOST: 'github.com',
      AUTH_PATH: '/etc/auth',
      AUTH_ENABLED: 'true',
    };
    expect(knownSecretsFromEnv(config)).toEqual([]);
    expect(knownSecretsFromEnv(config, ['GIT_AUTH_TRANSPORT'])).toEqual([
      'github.com',
    ]);
    const credentials = {
      AUTH: 'short',
      AUTH_TOKEN: 'github.com',
      AUTH_PASSWORD: 'false',
      AUTH_API_KEY: '/secret/path',
    };
    expect(knownSecretsFromEnv(credentials)).toEqual(
      Object.values(credentials)
    );
    expect(knownSecretsFromEnv({ AUTH_TRANSPORT_TOKEN: 'opaque' })).toEqual([
      'opaque',
    ]);
  });
});
