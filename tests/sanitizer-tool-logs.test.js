import { describe, it, expect } from 'test-anywhere';
import {
  sanitize,
  createSanitizer,
  knownSecretsFromEnv,
} from '../src/index.js';

export const publicLogLines = [
  "Command: gate='/tmp/hive-mind-disk-baseline-0ce9e170-e6d3-494d-91e1-0d820245d34b'",
  '🧠 Formal AI: endpoint http://172.18.0.2:8080/api/openai/v1',
  'proxy example: "socks5://127.0.0.1:1080"',
  'local 10.0.0.5 192.168.1.10 127.10.20.30 ::1 fc00::1234 fe80::1234',
  'ip: 127.0.0.1',
  'INFO codex_otel.log_only: event.name="codex.conversation_starts" auth_mode="Chatgpt"',
  'auth_method: "oauth"',
  'auth_mode="ApiKey"',
  'use: curl -L -H "Authorization: token $(gh auth token)" -o <filename> <url>',
  '  "devDependencies": { "secretlint": "^9.0.0", "next-auth": "^5.0.0", "@secretlint/secretlint-rule-preset-recommend": "^9.0.0" }',
  'permissions:\n  id-token: write',
  'token: ${{ secrets.NPM_TOKEN }}',
  'total_tokens: 100000',
];
describe('public tool log false positives (issue 40)', () => {
  for (const line of publicLogLines) {
    it(`preserves ${JSON.stringify(line)}`, async () => {
      expect(sanitize(line).text).toBe(line);
      expect((await createSanitizer().sanitize(line)).text).toBe(line);
      const json = JSON.stringify({ text: line });
      expect((await createSanitizer().sanitizeJsonl(json)).text).toBe(json);
    });
  }
  for (const value of [
    `sk-${'a1B2'.repeat(8)}`,
    `sk-proj-${'a1B2'.repeat(8)}`,
    'Authorization: token 0123456789abcdef0123456789abcdef01234567',
    'auth_token="actual-sensitive-value"',
    'password: "^9.0.0"',
    'id-token: actual-sensitive-value',
    'Authorization: token $(printf actual-sensitive-value)',
    '::1234',
  ]) {
    it(`keeps credential detection ${value.slice(0, 20)}`, async () => {
      expect((await createSanitizer().sanitize(value)).redactions > 0).toBe(
        true
      );
    });
  }
});
describe('environment discovery (issue 42)', () => {
  it('discovers every credential entry in the upstream curated list individually', () => {
    const names = [
      'TELEGRAM_BOT_TOKEN',
      'GH_TOKEN',
      'GITHUB_TOKEN',
      'GITHUB_PAT',
      'ANTHROPIC_API_KEY',
      'CLAUDE_API_KEY',
      'CLAUDE_CODE_OAUTH_TOKEN',
      'OPENAI_API_KEY',
      'CODEX_API_KEY',
      'OPENCODE_API_KEY',
      'AGENT_CLI_TOKEN',
      'GEMINI_API_KEY',
      'GOOGLE_API_KEY',
      'QWEN_API_KEY',
      'DASHSCOPE_API_KEY',
      'HUGGINGFACE_TOKEN',
      'HF_TOKEN',
    ];
    for (const name of names) {
      expect(knownSecretsFromEnv({ [name]: `fixture-${name}` })).toEqual([
        `fixture-${name}`,
      ]);
    }
    // A chat account ID is personal metadata, not a credential-named variable.
    expect(
      knownSecretsFromEnv({ TELEGRAM_OWNER_CHAT_ID: '123456789' })
    ).toEqual([]);
  });
  it('discovers secret-named variables and keeps explicit selection', () => {
    const env = {
      MY_SERVICE_TOKEN: 'opaque-one',
      CLAUDE_CODE_OAUTH_TOKEN: 'opaque-one',
      CODEX_API_KEY: 'opaque-one',
      DASHSCOPE_API_KEY: 'opaque-one',
      HF_TOKEN: 'opaque-one',
      TELEGRAM_BOT_TOKEN: 'opaque-one',
      OPENCODE_API_KEY: 'opaque-two',
      LOCAL_PRIVATEKEY: 'opaque-three',
      CUSTOM: 'selected',
      EMPTY_AUTH: '',
      PATH: '/usr/bin',
      MONKEY: 'public',
      TOKENS: '1000',
    };
    expect(knownSecretsFromEnv(env).sort()).toEqual([
      'opaque-one',
      'opaque-three',
      'opaque-two',
    ]);
    expect(knownSecretsFromEnv(env, ['CUSTOM'])).toEqual(['selected']);
    expect(knownSecretsFromEnv(env, [])).toEqual([]);
  });
});

describe('credentials-only policy (issue 42)', () => {
  it('preserves account details in native, required engine, JSON and decoded views', async () => {
    const input =
      'name: Jane Roe\nemail: jane@private.example\nuser: private-user\npassword: hunter2';
    const options = { credentialsOnly: true };
    for (const result of [
      sanitize(input, options),
      await createSanitizer(options).sanitize(input),
    ]) {
      expect(result.text.includes('jane@private.example')).toBe(true);
      expect(result.text.includes('Jane Roe')).toBe(true);
      expect(result.text.includes('hunter2')).toBe(false);
      expect(result.findings.every((f) => f.category === 'credential')).toBe(
        true
      );
    }
    const json = JSON.stringify({
      email: 'jane@private.example',
      password: 'hunter2',
    });
    expect(
      JSON.parse((await createSanitizer(options).sanitizeJsonl(json)).text)
    ).toEqual({
      email: 'jane@private.example',
      password: '[REDACTED]',
    });
    const encoded = Buffer.from('email: jane@private.example').toString(
      'base64'
    );
    expect((await createSanitizer(options).sanitize(encoded)).text).toBe(
      encoded
    );
    const custom = createSanitizer({
      ...options,
      secretlint: false,
      detectors: [
        {
          detect: (text) =>
            text === 'private'
              ? [
                  {
                    start: 0,
                    end: 7,
                    category: 'personal',
                    type: 'ID',
                    rule: 'custom',
                  },
                ]
              : [],
        },
      ],
    });
    expect((await custom.sanitize('private')).text).toBe('private');
  });
});
