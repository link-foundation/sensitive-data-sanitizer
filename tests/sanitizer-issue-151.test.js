import { describe, it, expect } from 'test-anywhere';
import { Buffer } from 'node:buffer';
import {
  createSyncSanitizer,
  createSanitizer,
} from '../src/credentials-entry.js';

const options = { transformation: { mode: 'hive-mask' } };
const engine = createSyncSanitizer(options);
const unchanged = [
  'set `password=<secret>` in the config',
  '`-c model_auto_compact_token_limit=<tokens>` overrides.',
  '`HIVE_MIND_CLAUDE_AUTH_AUTHORITY=conventional` to opt out.',
  '`HIVE_MIND_ROUTER_AUTH_GUARD=0` disables it.',
  '`HIVE_MIND_DISABLE_GIT_AUTH_TRANSPORT=1` opts out.',
  'named variables (`fileTokens = await …`, `…Tokens: false`) are no longer masked',
  'Logs containing `token => …` or a short known env value are published',
  '- `KNOWN_LOCAL_TOKEN_ENV_VARS` registry masks tokens by exact env value',
  'Enhance --tokens-budget-stats with sub-session tracking',
  'prevented the --tokens-budget-stats option from working',
  'run with --max-tokens 4096',
];
// Synthetic credential material, assembled to avoid source secret scanners.
const secret = ['credential', 'Material', '123456789'].join('-');

describe('Markdown documentation exemptions (issue 151)', () => {
  it('preserves all five original release-note reproductions on repeated passes', () => {
    for (const input of unchanged) {
      let text = input;
      for (let pass = 0; pass < 3; pass++) {
        text = engine.sanitize(text).text;
        expect(text).toBe(input);
      }
      expect(engine.inspect(input)).toEqual([]);
    }
  });

  it('preserves the same documentation through the async engine', async () => {
    const sanitizer = createSanitizer(options);
    for (const input of unchanged) {
      expect((await sanitizer.sanitize(input)).text).toBe(input);
    }
  });

  it('preserves documentation inside a decoded base64 view', () => {
    const sanitizer = createSyncSanitizer({
      ...options,
      preserveEncoding: true,
    });
    for (const input of unchanged) {
      const text = `body ${Buffer.from(input).toString('base64')} end`;
      expect(sanitizer.sanitize(text).text).toBe(text);
    }
  });

  it('recognizes complete placeholders and existing configuration pairs', () => {
    for (const ticks of ['`', '``']) {
      for (const assignment of [
        'password=<API token>',
        'password=${PASSWORD}',
        'password=$PASSWORD',
        'password=$(gh auth token)',
        'password=${{ secrets.PASSWORD }}',
        'AUTH_MODE=oauth',
        'AUTH_ENABLED=true',
        '--password=<secret>',
      ]) {
        const text = `Use ${ticks}${assignment}${ticks} here.`;
        expect(engine.sanitize(text).text).toBe(text);
      }
    }
    const text = 'HIVE_MIND_CLAUDE_AUTH_AUTHORITY=conventional';
    expect(engine.sanitize(text).text).toBe(text);
  });

  it('still masks HTML/script literals and keyword-prefixed credential values', () => {
    for (const value of [
      '<script>alert(1)</script>',
      secret,
      `token ${secret}`,
      `Bearer ${secret}`,
      `Basic ${secret}`,
      `<secret>${secret}`,
    ]) {
      for (const key of ['token:', 'password=', '--token ']) {
        const text = `Use \`${key}${value}\` here.`;
        const output = engine.sanitize(text).text;
        expect(output).not.toContain(value);
        if (value.includes(secret)) {
          expect(output).not.toContain(secret);
        }
      }
    }
  });

  it('masks Markdown-wrapped values and preserves literal backticks in quoted secrets', () => {
    for (const ticks of ['`', '``']) {
      const input = `password=${ticks}${secret}${ticks}`;
      expect(engine.sanitize(input).text).not.toContain(secret);
    }
    for (const quote of ['"', "'"]) {
      const value = `literal${String.fromCharCode(96)}${secret}`;
      const input = `password=${quote}${value}${quote}`;
      expect(engine.sanitize(input).text).not.toContain(secret);
    }
  });

  it('requires a matching Markdown delimiter run and scans long unmatched runs', () => {
    for (const count of [2, 256]) {
      const ticks = '`'.repeat(count);
      const input = `password=${ticks}literal${ticks}\`${secret}${ticks}`;
      expect(engine.sanitize(input).text).not.toContain(secret);
      for (const placeholder of ['<secret>', '$PASSWORD']) {
        const assignment = `${ticks}password=${placeholder}${ticks}\`${secret}${ticks}`;
        expect(engine.sanitize(assignment).text).not.toContain(secret);
      }
      const unterminated = `password=${ticks}literal${ticks}\`${secret}`;
      expect(engine.sanitize(unterminated).text).not.toContain(secret);
    }
  });

  it('does not extend enum exemptions to other names or values', () => {
    for (const assignment of [
      'HIVE_MIND_CLAUDE_AUTH_AUTHORITY=unrecognized',
      'OTHER_AUTH_AUTHORITY=conventional',
      'AUTH_TOKEN=conventional',
      'AUTH_PASSWORD=0',
      'HIVE_MIND_CLAUDE_AUTH_AUTHORITY=token conventional',
      'HIVE_MIND_ROUTER_AUTH_GUARD=Bearer 0',
      `HIVE_MIND_CLAUDE_AUTH_AUTHORITY=conventional${secret}`,
      `HIVE_MIND_ROUTER_AUTH_GUARD=0${secret}`,
      `password=<secret>${secret}`,
    ]) {
      const text = `Use \`${assignment}\` here.`;
      expect(engine.sanitize(text).text).not.toBe(text);
    }
  });

  it('keeps exact known secrets authoritative inside exempt documentation', () => {
    for (const value of ['<secret>', '<tokens>', 'conventional', '0', '1']) {
      const sanitizer = createSyncSanitizer({
        ...options,
        knownSecrets: [value],
      });
      const input = unchanged.find((text) => text.includes(`=${value}\``));
      expect(sanitizer.sanitize(input).text).not.toContain(`=${value}\``);
    }
  });

  it('still masks later credentials beside documented placeholders', () => {
    const text = `${unchanged[0]}; password=${secret}`;
    const output = engine.sanitize(text).text;
    expect(output).toContain(unchanged[0]);
    expect(output).not.toContain(secret);
  });
});
