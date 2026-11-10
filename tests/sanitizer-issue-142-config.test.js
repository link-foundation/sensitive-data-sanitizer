import { describe, it, expect } from 'test-anywhere';
import {
  sanitize,
  createSanitizer,
  createSyncSanitizer,
} from '../src/index.js';

// Synthetic values, assembled at run time so secret scanners skip the source.
const GH = ['ghp_', 'Zx9Qw7Er5Ty3Ui1Op0As', '2Df4Gh6Jk8Lz0Xc2Vb4N'].join('');
const KEEP = ['keep', 'this', 'value', '123'].join('-');
const HIVE = {
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
};
const hive = (text, options = {}) =>
  createSyncSanitizer({ ...HIVE, ...options }).sanitize(text).text;

describe('configuration settings stay readable (issue 134)', () => {
  it('keeps numeric and boolean values of configuration names', async () => {
    for (const text of [
      'HIVE_MIND_ROUTER_AUTH_GUARD=0',
      'GIT_AUTH_TRANSPORT=1',
      'AUTH_MODE=2',
      'AUTH_ENABLED=true',
      'oauth.timeout=30',
      'AUTH_DISABLED=off',
    ]) {
      expect(hive(text)).toBe(text);
      expect(sanitize(text, { credentialsOnly: true }).text).toBe(text);
      expect(
        (await createSanitizer({ credentialsOnly: true }).sanitize(text)).text
      ).toBe(text);
    }
  });
  it('still masks credential names and non-flag values', () => {
    expect(sanitize('AUTH_TOKEN=123456', { credentialsOnly: true }).text).toBe(
      'AUTH_TOKEN=[REDACTED]'
    );
    expect(sanitize('AUTH_PASSWORD=1', { credentialsOnly: true }).text).toBe(
      'AUTH_PASSWORD=[REDACTED]'
    );
    expect(
      sanitize(`AUTH_MODE=${GH}`, { credentialsOnly: true }).text
    ).not.toContain(GH);
  });
});

describe('exempt hook (issue 135)', () => {
  const text = `FEATURE_TOKEN=${KEEP}\nother_token=${KEEP}\nAUTH_TOKEN=${GH}`;
  const expected = `FEATURE_TOKEN=${KEEP}\nother_token=[REDACTED]\nAUTH_TOKEN=[REDACTED]`;
  const exempt = (finding, source) =>
    finding.value === KEEP &&
    /FEATURE_TOKEN=$/.test(source.slice(0, finding.start));

  it('keeps an exempted span and catches the same value elsewhere', async () => {
    const options = { credentialsOnly: true, exempt };
    expect(createSyncSanitizer(options).sanitize(text).text).toBe(expected);
    expect(sanitize(text, options).text).toBe(expected);
    expect((await createSanitizer(options).sanitize(text)).text).toBe(expected);
    const findings = createSyncSanitizer(options).inspect(text);
    expect(findings.some((finding) => finding.start === 14)).toBe(false);
  });
  it('awaits an async hook in the async engine', async () => {
    const result = await createSanitizer({
      credentialsOnly: true,
      exempt: async (finding) => finding.value === KEEP,
    }).sanitize(text);
    expect(result.text).toBe(
      `FEATURE_TOKEN=${KEEP}\nother_token=${KEEP}\nAUTH_TOKEN=[REDACTED]`
    );
  });
  it('keeps a value without ERR_RESIDUAL where a callback cannot', () => {
    const input = 'HIVE_MIND_ROUTER_AUTH_SECRET=abc123def456ghi789';
    expect(() =>
      createSyncSanitizer({
        credentialsOnly: true,
        transformation: (finding) => finding.value,
      }).sanitize(input)
    ).toThrow();
    expect(
      createSyncSanitizer({
        credentialsOnly: true,
        transformation: () => '<hidden>',
        exempt: () => true,
      }).sanitize(input).text
    ).toBe(input);
  });
  it('passes a read-only finding with its value', () => {
    const seen = [];
    createSyncSanitizer({
      credentialsOnly: true,
      exempt: (finding, source) => {
        seen.push(finding);
        expect(Object.isFrozen(finding)).toBe(true);
        expect(source.slice(finding.start, finding.end)).toBe(finding.value);
        return false;
      },
    }).sanitize(`token: ${GH}`);
    expect(seen.length > 0).toBe(true);
  });
  it('never offers declared known secrets', () => {
    expect(
      createSyncSanitizer({
        knownSecrets: [KEEP],
        exempt: () => true,
      }).sanitize(`value ${KEEP} here`).text
    ).toBe('value [REDACTED] here');
  });
  it('rejects invalid hooks and results', async () => {
    const code = (run) => {
      try {
        run();
      } catch (error) {
        return error.code;
      }
      return undefined;
    };
    expect(code(() => createSyncSanitizer({ exempt: 'yes' }))).toBe(
      'ERR_CONFIG'
    );
    expect(
      code(() =>
        createSyncSanitizer({
          credentialsOnly: true,
          exempt: () => 1,
        }).sanitize(text)
      )
    ).toBe('ERR_CONFIG');
    expect(
      code(() =>
        createSyncSanitizer({
          credentialsOnly: true,
          exempt: () => undefined,
        }).sanitize(text)
      )
    ).toBe('ERR_CONFIG');
    expect(
      code(() =>
        createSyncSanitizer({
          credentialsOnly: true,
          exempt: async () => true,
        }).sanitize(text)
      )
    ).toBe('ERR_CONFIG');
    let asyncCode;
    try {
      await createSanitizer({
        credentialsOnly: true,
        exempt: async () => 'yes',
      }).sanitize(text);
    } catch (error) {
      asyncCode = error.code;
    }
    expect(asyncCode).toBe('ERR_CONFIG');
  });
});
