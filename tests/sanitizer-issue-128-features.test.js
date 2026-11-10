import { describe, it, expect } from 'test-anywhere';
import { Readable } from 'node:stream';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  sanitize,
  inspect,
  createSanitizer,
  createPatternDetector,
  decrypt,
  toSarif,
} from '../src/index.js';
import { runCli } from '../bin/sensitive-data-sanitizer.js';

// Competitor-equivalent configuration features: Presidio allow_list and
// PatternRecognizer, Google exclusion/hotword rules, CharacterMaskConfig and
// CryptoDeterministicConfig, Azure per-category confidence, and SARIF output
// from Gitleaks/Betterleaks, TruffleHog and Kingfisher.
const key = 'k'.repeat(32);
const code = (fn) => {
  try {
    fn();
  } catch (error) {
    return error.code;
  }
  return undefined;
};

describe('allow lists', () => {
  it('keeps exact and fully matched values only', () => {
    const text = 'mail noreply@example.com or bob@private.test';
    expect(sanitize(text, { allowList: ['noreply@example.com'] }).text).toBe(
      'mail noreply@example.com or [REDACTED]'
    );
    expect(sanitize(text, { allowList: [/.+@example\.com/] }).text).toBe(
      'mail noreply@example.com or [REDACTED]'
    );
    // A partial pattern never exempts a longer value.
    expect(sanitize(text, { allowList: [/noreply/] }).text).toBe(
      'mail [REDACTED] or [REDACTED]'
    );
  });
  it('never exempts declared values or credentials by default', () => {
    expect(
      sanitize('owner alice@private.test', {
        knownPersonal: [{ type: 'EMAIL', value: 'alice@private.test' }],
        allowList: ['alice@private.test'],
      }).text
    ).toBe('owner [REDACTED]');
    const token = ['ghp', '_', 'A'.repeat(36)].join('');
    expect(sanitize(`t ${token}`, { allowList: [token] }).text).toBe(
      't [REDACTED]'
    );
  });
  it('applies to structured and asynchronous scans', async () => {
    const json = JSON.stringify({ a: 'noreply@example.com', b: 'x@y.test' });
    const result = sanitize(json, {
      structured: 'json',
      allowList: ['noreply@example.com'],
    }).text;
    expect(JSON.parse(result)).toEqual({
      a: 'noreply@example.com',
      b: '[REDACTED]',
    });
    const engine = createSanitizer({
      secretlint: false,
      allowList: ['noreply@example.com'],
    });
    expect((await engine.sanitize('to noreply@example.com')).text).toBe(
      'to noreply@example.com'
    );
  });
  it('rejects malformed lists', () => {
    expect(code(() => sanitize('x', { allowList: [1] }))).toBe('ERR_CONFIG');
    expect(code(() => sanitize('x', { allowList: [''] }))).toBe('ERR_CONFIG');
    expect(code(() => sanitize('x', { allowList: 'a' }))).toBe('ERR_CONFIG');
  });
});

describe('inline suppression comments', () => {
  const secret = 'secret = "hunter2"';
  it('is ignored unless inlineAllow is enabled', () => {
    expect(sanitize(`${secret} # pragma: allowlist secret`).text).toBe(
      'secret = "[REDACTED]" # pragma: allowlist secret'
    );
  });
  it('honours same-line and next-line scanner directives', () => {
    const options = { inlineAllow: true, allowCredentialDisable: true };
    for (const directive of [
      '# pragma: allowlist secret',
      '# gitleaks:allow',
      '# kingfisher:ignore',
      '// trufflehog:ignore',
      '// NOSONAR',
    ]) {
      expect(sanitize(`${secret} ${directive}`, options).text).toBe(
        `${secret} ${directive}`
      );
    }
    expect(
      sanitize(`# pragma: allowlist nextline secret\n${secret}\n${secret}`, {
        ...options,
      }).text
    ).toBe(
      `# pragma: allowlist nextline secret\n${secret}\nsecret = "[REDACTED]"`
    );
  });
  it('needs allowCredentialDisable for credentials', () => {
    expect(
      sanitize(`${secret} # gitleaks:allow`, { inlineAllow: true }).text
    ).toBe('secret = "[REDACTED]" # gitleaks:allow');
    expect(
      sanitize('mail bob@private.test # gitleaks:allow', { inlineAllow: true })
        .text
    ).toBe('mail bob@private.test # gitleaks:allow');
    expect(code(() => sanitize('x', { inlineAllow: 'yes' }))).toBe(
      'ERR_CONFIG'
    );
  });
});

// Built at runtime so secret scanners do not flag sample URIs.
const pg = ['postgres', '://'].join('');

describe('template and mask credential values', () => {
  it('keeps variable references, placeholders and masks', () => {
    for (const text of [
      `${pg}<username>:<password>@db.internal/app`,
      'curl -u "${username}":"${password}"',
      'curl --user "$1:$2"',
      'curl -H "Authorization: Bearer <Openverse API token>"',
      'curl -H "Authorization: Bearer XXXXXXXXXXXX"',
      'curl -H "Authorization: Token **********"',
      'password: $${PYPI_PASSWORD}',
      'mysqladmin --password="$DB_PASS"',
    ]) {
      expect(sanitize(text).text).toBe(text);
    }
  });
  it('still redacts literal or mixed values', () => {
    expect(sanitize(`${pg}alice:\${DB_PASSWORD}@db/app`).text).toBe(
      `${pg}[REDACTED]@db/app`
    );
    expect(sanitize('Authorization: Bearer <x>abc123def456ghi789').text).toBe(
      'Authorization: [REDACTED]'
    );
    expect(sanitize('password: ${A}', { knownSecrets: ['${A}'] }).text).toBe(
      'password: [REDACTED]'
    );
  });
});

describe('escape runs, NUL-interleaved text and HTML formatting', () => {
  const secret = 'token: "Zf3D0LXCM3EIMbgJpUNnkRtOfOueHznB"';
  const hex = [...secret].map((c) => c.codePointAt(0).toString(16));
  const expectRedacted = (text) => {
    const result = sanitize(text);
    expect(result.findings.length > 0).toBe(true);
    expect(result.text.includes('[REDACTED]')).toBe(true);
  };
  it('decodes U+XXXX runs, \\x{X} and CSS escapes', () => {
    expectRedacted(
      hex.map((h) => `U+${h.padStart(4, '0').toUpperCase()}`).join(' ')
    );
    expectRedacted(hex.map((h) => `\\x{${h}}`).join(''));
    expectRedacted(`${hex.map((h) => `\\${h}`).join(' ')} `);
  });
  it('ignores NUL bytes of UTF-16 text read as single bytes', () => {
    expectRedacted([...secret].join('\0'));
  });
  it('joins tokens split by formatting tags', () => {
    expect(
      sanitize('<p>token=<em><strong>sk-live-abc123</strong></em></p>').text
    ).toBe('<p>token=<em><strong>[REDACTED]</strong></em></p>');
  });
  it('leaves prose, short code references and placeholders alone', () => {
    const text =
      'Use U+200B for zero width; see <b>bold</b>, <username>:<password> and C:\\dev\\abc\\data';
    expect(sanitize(text).text).toBe(text);
  });
});

describe('per-type confidence thresholds', () => {
  it('overrides minConfidence for listed types only', () => {
    const text = 'Contact John Smith at john@private.test';
    const strict = sanitize(text, { minConfidenceByType: { PERSON: 0.99 } });
    expect(strict.text).toBe('Contact John Smith at [REDACTED]');
    expect(
      code(() => sanitize(text, { minConfidenceByType: { PERSON: 2 } }))
    ).toBe('ERR_CONFIG');
    expect(
      code(() => sanitize(text, { minConfidenceByType: { person: 0.5 } }))
    ).toBe('ERR_CONFIG');
  });
});

describe('character mask options', () => {
  const mask = (value, options) =>
    sanitize(value, { transformation: { mode: 'mask', ...options } }).text;
  it('supports count, char, ignore, classes and reverse order', () => {
    expect(mask('SSN 372-81-9127', { count: 5, char: '#' })).toBe(
      'SSN #####1-9127'
    );
    expect(mask('card 4111-1111-1111-1111', { keepEnd: 4, ignore: '-' })).toBe(
      'card ****-****-****-1111'
    );
    expect(mask('call 212-555-0198', { count: 4, fromEnd: true })).toBe(
      'call 212-555-****'
    );
    expect(
      mask('mail jane.smith@corp.com', { ignoreClasses: ['punctuation'] })
    ).toBe('mail ****.*****@****.***');
  });
  it('rejects ambiguous or malformed options', () => {
    for (const options of [
      { marker: '***', count: 2 },
      { char: '**' },
      { count: 0 },
      { ignoreClasses: ['emoji'] },
    ]) {
      expect(
        code(() =>
          sanitize('a@b.test', { transformation: { mode: 'mask', ...options } })
        )
      ).toBe('ERR_CONFIG');
    }
  });
});

describe('deterministic encryption', () => {
  const text = 'from jane@private.test to jane@private.test';
  it('produces equal tokens for equal values and round-trips', async () => {
    const result = sanitize(text, {
      transformation: { mode: 'encrypt', key },
    }).text;
    const tokens = result.match(/\[ENCRYPTED:EMAIL:[A-Za-z0-9_-]+\]/g);
    expect(tokens.length).toBe(2);
    expect(tokens[0]).toBe(tokens[1]);
    expect(result.includes('jane')).toBe(false);
    expect(decrypt(result, key)).toBe(text);
    const engine = createSanitizer({
      secretlint: false,
      transformation: { mode: 'encrypt', key },
    });
    expect(decrypt((await engine.sanitize(text)).text, key)).toBe(text);
  });
  it('restores JSON string values and rejects a wrong key', () => {
    const json = JSON.stringify({ note: 'Name: "Jane" jane@private.test' });
    const out = sanitize(json, {
      structured: 'json',
      transformation: { mode: 'encrypt', key },
    }).text;
    expect(JSON.parse(decrypt(out, key, { json: true }))).toEqual(
      JSON.parse(json)
    );
    expect(code(() => decrypt(out, 'w'.repeat(32)))).toBe('ERR_MAP');
    expect(code(() => decrypt(1, key))).toBe('ERR_INPUT');
    expect(
      code(() =>
        sanitize('a@b.test', {
          transformation: { mode: 'encrypt', key: 'short' },
        })
      )
    ).toBe('ERR_CONFIG');
  });
  it('still fully redacts credentials', () => {
    const token = ['ghp', '_', 'B'.repeat(36)].join('');
    expect(
      sanitize(`t ${token}`, { transformation: { mode: 'encrypt', key } }).text
    ).toBe('t [REDACTED]');
  });
});

describe('declarative pattern detectors', () => {
  // Google Sensitive Data Protection hotword example (custom C_MRN infoType).
  const mrn = createPatternDetector({
    type: 'MEDICAL_RECORD',
    patterns: [/[0-9]{3}-[0-9]{1}-[0-9]{5}/],
    confidence: 0.4,
    context: ['mrn', 'medical'],
    contextWindow: { before: 10 },
  });
  const text = "Patient's MRN 444-5-22222 and just a number 333-2-33333";
  it('raises confidence with nearby hotwords', () => {
    const found = inspect(text, { detectors: [mrn] }).filter(
      (f) => f.rule === 'custom-pattern'
    );
    expect(found.map((f) => [f.start, f.confidence])).toEqual([
      [14, 0.75],
      [44, 0.4],
    ]);
    expect(sanitize(text, { detectors: [mrn] }).text).toBe(
      "Patient's MRN [REDACTED] and just a number 333-2-33333"
    );
  });
  it('supports deny lists, groups and validation callbacks', () => {
    const titles = createPatternDetector({
      type: 'TITLE',
      denyList: ['Mr.', 'Mrs.', 'Prof.'],
    });
    expect(
      titles.detect('Prof. Plum and Professor Mrs.X').map((f) => f.start)
    ).toEqual([0]);
    const employee = createPatternDetector({
      type: 'EMPLOYEE_ID',
      rule: 'employee-id',
      patterns: [{ regex: /emp=(E\d{4})/, group: 1, confidence: 0.3 }],
      validate: (value) => (value.endsWith('7') ? 0.9 : false),
    });
    expect(employee.detect('emp=E1237 emp=E1238')).toEqual([
      {
        start: 4,
        end: 9,
        type: 'EMPLOYEE_ID',
        category: 'personal',
        rule: 'employee-id',
        confidence: 0.9,
      },
    ]);
  });
  it('lowers confidence with a negative context boost', () => {
    const order = createPatternDetector({
      type: 'ACCOUNT_ID',
      patterns: [/\b\d{6}\b/],
      confidence: 0.6,
      context: ['order'],
      contextBoost: -0.3,
    });
    expect(order.detect('order 123456').map((f) => f.confidence)).toEqual([
      0.3,
    ]);
  });
  it('rejects malformed specifications', () => {
    for (const spec of [
      {},
      { type: 'bad', patterns: [/x/] },
      { type: 'X', patterns: [] },
      { type: 'X', patterns: ['('] },
      { type: 'X', patterns: [/x/], rule: 'Bad Rule' },
      { type: 'X', patterns: [/x/], contextWindow: -1 },
      { type: 'X', denyList: [' '] },
    ]) {
      expect(code(() => createPatternDetector(spec))).toBe('ERR_CONFIG');
    }
  });
});

describe('SARIF export', () => {
  it('reports rules and locations without values', () => {
    const findings = inspect('mail bob@private.test');
    const log = toSarif(findings, { path: 'logs/app.log', version: '1.0.0' });
    expect(log.version).toBe('2.1.0');
    const [run] = log.runs;
    expect(run.tool.driver.rules.map((r) => r.id)).toEqual(['email']);
    expect([run.results[0].ruleId, run.results[0].level]).toEqual([
      'email',
      'warning',
    ]);
    expect(run.results[0].locations[0].physicalLocation).toEqual({
      artifactLocation: { uri: 'logs/app.log' },
      region: { charOffset: 5, charLength: 16, startLine: 1, startColumn: 6 },
    });
    expect(JSON.stringify(log).includes('bob')).toBe(false);
  });
  it('is available from the scan command', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sds-sarif-'));
    try {
      const file = join(dir, 'a.log');
      await writeFile(file, 'mail bob@private.test\n');
      let output = '';
      const status = await runCli(
        ['scan', file, '--native-only', '--format', 'sarif'],
        {
          stdin: Readable.from([]),
          stdout: { write: (value) => (output += value) },
          stderr: { write: () => {} },
        }
      );
      expect(status).toBe(1);
      const log = JSON.parse(output);
      expect(log.runs[0].results[0].ruleId).toBe('email');
      expect(output.includes('bob@')).toBe(false);
      expect(
        await runCli(['redact', file, '--format', 'sarif'], {
          stdin: Readable.from([]),
          stdout: { write: () => {} },
          stderr: { write: () => {} },
        })
      ).toBe(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
