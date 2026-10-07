import { describe, it, expect } from 'test-anywhere';
import {
  sanitize,
  inspect,
  createSanitizer,
  fromGitleaks,
  fromTrufflehog,
  fromPresidio,
  fromDetectSecrets,
  byteRange,
  fromOffsetReport,
  knownSecretsFromEnv,
  personalVariants,
} from '../src/index.js';

const value = 'Az19Bc28De37Fg46Hi55Jk64Lm73No82Pq91';
const services = [
  ['github', `ghp_${value}`],
  ['gitlab', `glpat-${value}-`],
  ['openai', `sk-proj-${value}`],
  ['anthropic', `sk-ant-api03-${value}`],
  ['aws', `AKIA${'A1'.repeat(8)}`],
  ['google', `AIza${'a'.repeat(35)}`],
  ['slack', `xoxb-${value}`],
  ['stripe', `sk_live_${value}`],
  ['sendgrid', `SG.${value}.${value}`],
  ['twilio', `SK${'ab'.repeat(16)}`],
  ['npm', `npm_${value}`],
  ['pypi', `pypi-${value}`],
  ['telegram', `123456789:${value}`],
  ['discord', `MT${value}.Ab19Cd.${value}`],
  ['huggingface', `hf_${value}`],
  ['shopify', `shpat_${'ab'.repeat(16)}`],
  ['databricks', `dapi${'ab'.repeat(16)}`],
  ['square', `sq0atp-${value}`],
  ['mailchimp', `${'ab'.repeat(16)}-us12`],
  ['digitalocean', `dop_v1_${'ab'.repeat(32)}`.replace('dop_', 'dopat_')],
  ['vault', `hvs.${value}`],
  ['grafana', `glsa_${value}`],
  ['linear', `lin_api_${value}`],
  ['notion', `ntn_${value}`],
  ['vercel', `vercel_${value}`],
  ['jwt', `eyJ${value}.eyJ${value}.${value}`],
];

describe('provider and context coverage', () => {
  for (const [service, secret] of services) {
    it(`masks the complete ${service} value at punctuation boundaries`, () => {
      expect(sanitize(`(${secret})`).text).toBe('([REDACTED])');
    });
  }
  for (const input of [
    'password=1234',
    'password="a b"',
    "--password 'a b'",
    '--password a-b',
    '<password>abc</password>',
    'api_key: abc',
    'https://user:password@example.org/db',
    'Authorization: Bearer abc',
    'Cookie: sid=abc; other=def',
    '?sig=a%2Fb%3D',
    '-----BEGIN RSA PRIVATE KEY-----\nabc',
    '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
  ]) {
    it(`detects ${input.split(/[=: ]/)[0]} credential context`, () => {
      expect(inspect(input).some((f) => f.category === 'credential')).toBe(
        true
      );
    });
  }
  it('preserves delimiters in escaped JSON inside AI-session records', () => {
    const input = JSON.stringify({
      stdout: JSON.stringify({ password: 'short', ok: 1 }),
    });
    const result = sanitize(input);
    expect(JSON.parse(JSON.parse(result.text).stdout)).toEqual({
      password: '[REDACTED]',
      ok: 1,
    });
  });
  it('keeps counters, Git hashes, tool names, URLs and benign identifiers', () => {
    const input = `total_tokens=123 inputTokens=12 token_count=6 commit ${'ab'.repeat(
      20
    )} mcp__browser_navigate browser_click https://example.org/docs version=1.2.3`;
    expect(sanitize(input).text).toBe(input);
  });
  it('handles long non-URL identifiers and captures actual URL credentials', () => {
    const identifier = 'x'.repeat(16384);
    const result = sanitize(`${identifier} https://u:p@localhost`).text;
    expect(result.startsWith(identifier)).toBe(true);
    expect(result.endsWith('https://[REDACTED]@localhost')).toBe(true);
  });
  it('protects known secrets regardless of shape or case in matching personal values', () => {
    expect(
      sanitize('opaque-value JOHN DOE', {
        knownSecrets: ['opaque-value'],
        knownPersonal: [{ type: 'PERSON', value: 'John Doe' }],
      }).text
    ).toBe('[REDACTED] [REDACTED]');
  });
  it('normalizes literal dictionaries with the same rules as the input view', () => {
    expect(sanitize('ＡＢＣＤ', { knownSecrets: ['ＡＢＣＤ'] }).text).toBe(
      '[REDACTED]'
    );
    expect(
      sanitize('Ｊｏｈｎ', {
        knownPersonal: [{ type: 'PERSON', value: 'Ｊｏｈｎ' }],
      }).text
    ).toBe('[REDACTED]');
  });
  it('removes key fragments, email prefixes and suffixes completely', () => {
    const secret = services[0][1];
    const result = sanitize(`${secret} person@example.org`);
    expect(result.text).toBe('[REDACTED] [REDACTED]');
    expect(JSON.stringify(result.findings).includes(value)).toBe(false);
  });
});

describe('languages and representations', () => {
  for (const label of [
    'password',
    'senha',
    'contraseña',
    'mot_de_passe',
    'passwort',
    'пароль',
    '密码',
    '密碼',
    'パスワード',
    '비밀번호',
    'كلمة المرور',
    'סיסמה',
    'पासवर्ड',
    'şifre',
    'kata_sandi',
    'mật_khẩu',
    'รหัสผ่าน',
  ]) {
    it(`recognizes the ${label} label`, () => {
      expect(sanitize(`${label}: abc`).text).toBe(`${label}: [REDACTED]`);
    });
  }
  for (const [label, name] of [
    ['Имя', 'Иван Петров'],
    ['姓名', '张三'],
    ['氏名', '山田太郎'],
    ['नाम', 'आरव शर्मा'],
    ['الاسم', 'محمد علي'],
    ['name', 'Zoë Dubois'],
  ]) {
    it(`recognizes labelled ${label}`, () => {
      expect(sanitize(`${label}: ${name}`).text).toBe(`${label}: [REDACTED]`);
    });
  }
  it('keeps UTF-16 positions after emoji and maps fullwidth and JSON escapes', () => {
    const secret = services[0][1];
    expect(inspect(`😀 ${secret}`)[0].start).toBe(3);
    expect(sanitize('ｐａｓｓｗｏｒｄ：abc').text).toBe(
      'ｐａｓｓｗｏｒｄ：[REDACTED]'
    );
    expect(sanitize(secret.replace('g', '\\u0067')).text).toBe('[REDACTED]');
    expect(
      sanitize(`${secret.slice(0, 6)}\x1b[31m${secret.slice(6)}`).text
    ).toBe('[REDACTED]');
  });
  it('handles base64url, hex, percent encoding and bounded nested encodings', () => {
    const secret = services[0][1];
    const base64 = Buffer.from(secret).toString('base64url');
    for (const encoded of [
      base64,
      Buffer.from(base64).toString('base64'),
      Buffer.from(secret).toString('hex'),
      Array.from(secret, (c) => `%${c.charCodeAt(0).toString(16)}`).join(''),
    ]) {
      expect(sanitize(encoded).text).toBe('[REDACTED]');
    }
  });
  it('handles base64 wrapped across records and unknown formats recognized only by an adapter', async () => {
    const payload = Buffer.from(`password=${services[0][1]}`).toString(
      'base64'
    );
    expect(sanitize(`${payload.slice(0, 32)}\n${payload.slice(32)}`).text).toBe(
      '[REDACTED]'
    );
    const opaque = 'some-provider-opaque-value';
    const engine = createSanitizer({
      secretlint: false,
      detectors: [
        {
          id: 'opaque',
          detect: async (text) => {
            const start = text.indexOf(opaque);
            return start < 0
              ? []
              : [
                  {
                    start,
                    end: start + opaque.length,
                    type: 'SECRET',
                    category: 'credential',
                    rule: 'opaque',
                  },
                ];
          },
        },
      ],
    });
    expect(
      (await engine.sanitize(Buffer.from(opaque).toString('base64'))).text
    ).toBe('[REDACTED]');
  });
  it('validates card numbers and IP addresses and preserves invalid numbers', () => {
    expect(sanitize('4111 1111 1111 1111').text).toBe('[REDACTED]');
    expect(sanitize('4111 1111 1111 1112').text).toBe('4111 1111 1111 1112');
    expect(sanitize('192.168.1.2').text).toBe('[REDACTED]');
    expect(sanitize('999.999.999.999').text).toBe('999.999.999.999');
  });
  it('enforces finite input and finding limits and strict configuration', () => {
    expect(() => sanitize('abcd', { maxInputLength: 3 })).toThrow();
    expect(() =>
      sanitize('a@example.org b@example.org', { maxFindings: 1 })
    ).toThrow();
    expect(() => sanitize('safe', { unknown: true })).toThrow();
    expect(() =>
      sanitize('safe', {
        publicEntities: [
          {
            type: 'SECRET',
            value: 'x',
            source: 'https://example.org',
            reviewedAt: '2026-10-07',
          },
        ],
      })
    ).toThrow();
  });
});

describe('scanner interoperability', () => {
  it('rejects impossible calendar dates in reviewed public policies', () => {
    for (const reviewedAt of ['2026-02-30', '2026-13-01', '2025-02-29']) {
      expect(() =>
        sanitize('contact@example.org', {
          publicEntities: [
            {
              type: 'EMAIL',
              value: 'contact@example.org',
              source: 'https://example.org',
              reviewedAt,
            },
          ],
        })
      ).toThrow();
    }
  });
  it('rejects TruffleHog records without a usable raw detection', () => {
    for (const report of [[{}], [{ Raw: '' }], [{ Raw: 42 }]]) {
      expect(() => fromTrufflehog('ordinary text', report)).toThrow();
    }
  });
  it('accepts explicit cloud offset units without copying returned quotations', () => {
    const input = '😀 Иван';
    const entries = [
      {
        start: 5,
        end: 13,
        type: 'PERSON',
        category: 'personal',
        quote: 'never report this',
      },
    ];
    const findings = fromOffsetReport(input, entries, {
      unit: 'byte',
      rule: 'cloud-report',
    });
    expect(sanitize(input, { findings }).text).toBe('😀 [REDACTED]');
    expect(JSON.stringify(findings).includes('quote')).toBe(false);
    expect(() =>
      fromOffsetReport(input, entries, {
        unit: 'ambiguous',
        rule: 'cloud-report',
      })
    ).toThrow();
  });
  it('collects selected local secrets and personal document spellings explicitly', () => {
    expect(knownSecretsFromEnv({ GH_TOKEN: 'opaque', PATH: 'public' })).toEqual(
      ['opaque']
    );
    const knownPersonal = personalVariants([
      { type: 'DOB', value: '2000-01-02' },
    ]);
    expect(sanitize('02/01/2000 2000-01-02', { knownPersonal }).text).toBe(
      '[REDACTED] [REDACTED]'
    );
  });
  it('maps decoded TruffleHog reports to the complete encoded source', () => {
    const raw = 'opaque-provider-credential';
    const input = Buffer.from(raw).toString('base64');
    expect(
      sanitize(input, { findings: fromTrufflehog(input, [{ Raw: raw }]) }).text
    ).toBe('[REDACTED]');
  });
  it('rejects invalid ranges returned for encoded detection views', async () => {
    const input = Buffer.from('opaque-provider-credential').toString('base64');
    const engine = createSanitizer({
      secretlint: false,
      detectors: [
        {
          detect: async (text) =>
            text === 'opaque-provider-credential'
              ? [
                  {
                    start: -1,
                    end: 1,
                    category: 'credential',
                    type: 'SECRET',
                    rule: 'test',
                  },
                ]
              : [],
        },
      ],
    });
    let blocked = false;
    try {
      await engine.sanitize(input);
    } catch {
      blocked = true;
    }
    expect(blocked).toBe(true);
  });
  it('uses actual recommended Secretlint rules even when text has disable directives', async () => {
    const engine = createSanitizer();
    const input = '// secretlint-disable\n' + `ghp_${'a'.repeat(36)}`;
    const result = await engine.sanitize(input);
    expect(result.findings.some((f) => f.rule === 'secretlint')).toBe(true);
    expect(result.text.includes(services[0][1])).toBe(false);
  });
  it('redacts all occurrences from Gitleaks and TruffleHog without copying report metadata', () => {
    const input = 'opaque opaque';
    expect(
      sanitize(input, {
        findings: fromGitleaks(input, [
          { Secret: 'opaque', Match: 'do not report' },
        ]),
      }).text
    ).toBe('[REDACTED] [REDACTED]');
    expect(
      sanitize(input, {
        findings: fromTrufflehog(input, [{ Raw: 'opaque', Verified: false }]),
      }).text
    ).toBe('[REDACTED] [REDACTED]');
    expect(() => fromGitleaks('safe', [{ Secret: 'missing' }])).toThrow();
  });
  it('maps Python codepoint and UTF-8 byte ranges exactly after non-ASCII text', () => {
    const input = '😀 Иван';
    const findings = fromPresidio(input, [
      { entity_type: 'PERSON', start: 2, end: 6, score: 0.8 },
    ]);
    expect(sanitize(input, { findings }).text).toBe('😀 [REDACTED]');
    expect(byteRange(input, 5, 13)).toEqual({ start: 3, end: 7 });
    expect(() => byteRange(input, 1, 5)).toThrow();
  });
  it('supports hashed detect-secrets baselines by masking only the identified line', () => {
    const input = 'safe\nopaque secret\nend';
    const findings = fromDetectSecrets(
      input,
      {
        results: {
          'log.txt': [{ line_number: 2, hashed_secret: 'not published' }],
        },
      },
      'log.txt'
    );
    expect(sanitize(input, { findings }).text).toBe('safe\n[REDACTED]\nend');
  });
});
