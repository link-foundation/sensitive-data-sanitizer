import { describe, it, expect } from 'test-anywhere';
import {
  sanitize,
  createSanitizer,
  sanitizeStream,
  sanitizePayload,
  sanitizeFileBounded,
} from '../src/index.js';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../bin/sensitive-data-sanitizer.js';

describe('session and phone regressions (#9, #12)', () => {
  for (const text of [
    JSON.stringify({
      url: `https://example.org/search?q=${'word%20'.repeat(2000)}`,
    }),
    'A'.repeat(100) + `\n${'B'.repeat(100)}`.repeat(120),
  ]) {
    it('audits oversized encoded runs without blocking the whole input', async () => {
      const result = await createSanitizer().sanitize(text);
      expect(result.findings.some((f) => f.type === 'ENCODED_LIMIT')).toBe(
        true
      );
      expect(result.text.includes('[REDACTED]')).toBe(true);
      const output = [];
      for await (const chunk of sanitizeStream([text], { secretlint: false })) {
        output.push(chunk);
      }
      expect(output.join('').includes('[REDACTED]')).toBe(true);
    });
  }
  it('detects secrets encoded beyond the previous run limit', () => {
    const secret = 'ghp_' + 'Ab19Cd28Ef37Gh46Ij55Kl64Mn73Op82';
    for (const value of [
      encodeURIComponent('hello '.repeat(2000) + secret),
      Buffer.from('hello '.repeat(2000) + secret).toString('base64'),
    ]) {
      const result = sanitize(value);
      expect(result.text.includes(value)).toBe(false);
    }
  });
  it('audits oversized UTF-8 base64 even when its probe ends inside a character', () => {
    const secret = 'ghp_' + 'Ab19Cd28Ef37Gh46Ij55Kl64Mn73Op82';
    const value = Buffer.from(`a${'世'.repeat(2500)}${secret}`).toString(
      'base64'
    );
    const result = sanitize(value);
    expect(result.text).toBe('[REDACTED]');
    expect(result.findings.some((f) => f.type === 'ENCODED_LIMIT')).toBe(true);
  });
  it('keeps explicitly structural fields while sanitizing keys, values and nested JSON', async () => {
    const input = {
      type: 'tool_use',
      id: 'toolu_01CM9SwFYXq3vJ6cjYAFFjkf',
      name: 'Read',
      description: 'Use the secret: scanning utility to inspect source files.',
      input: {
        password: 'short',
        name: 'John Smith',
        'private@example.org': 'ordinary',
        content: 'DOB `02/03/1990`',
      },
      nested: JSON.stringify({ password: 'also-short', type: 'tool_result' }),
    };
    const engine = createSanitizer({
      structured: 'json',
      structuralFields: ['id', 'type', 'name', 'description'],
    });
    const result = await engine.sanitize(JSON.stringify(input));
    const output = JSON.parse(result.text);
    expect(output.id).toBe(input.id);
    expect(output.name).toBe('Read');
    expect(output.description).toBe(input.description);
    // Structural fields suppress heuristic personal/entropy/context findings;
    // complete names and credential formats still need explicit policy choices.
    expect(output.input.password).toBe('[REDACTED]');
    expect(output.input['private@example.org']).toBe(undefined);
    expect(output.input.content.includes('02/03/1990')).toBe(false);
    expect(JSON.parse(output.nested).password).toBe('[REDACTED]');
    expect(
      result.findings.every(
        (f) => Number.isInteger(f.start) && Number.isInteger(f.end)
      )
    ).toBe(true);
  });
  it('credentials and known personal values always override structural declarations', async () => {
    const secret = 'ghp_' + 'Ab19Cd28Ef37Gh46Ij55Kl64Mn73Op82';
    const engine = createSanitizer({
      structured: 'json',
      structuralFields: ['name', 'id'],
      knownPersonal: [{ type: 'PERSON', value: 'John Smith' }],
    });
    const result = JSON.parse(
      (
        await engine.sanitize(
          JSON.stringify({ name: secret, id: 'John Smith' })
        )
      ).text
    );
    expect(result).toEqual({ name: '[REDACTED]', id: '[REDACTED]' });
  });
});

describe('structured integration', () => {
  it('supports JSONL in streams and outbound JSON integration', async () => {
    const records = [
      JSON.stringify({
        id: 'req_123',
        name: 'Read',
        content: 'passport 58 39 204716',
      }),
      JSON.stringify({
        type: 'tool_result',
        content: 'WhatsApp: 8 912 555 0142',
      }),
    ];
    const engine = createSanitizer({
      structured: 'jsonl',
      structuralFields: ['id', 'name', 'type'],
      secretlint: false,
    });
    const output = [];
    for await (const chunk of sanitizeStream([`${records.join('\n')}\n`], {
      sanitizer: engine,
      batchBytes: 128,
    })) {
      output.push(chunk);
    }
    const lines = output
      .join('')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(lines[0].name).toBe('Read');
    expect(lines.every((line) => line.content.includes('[REDACTED]'))).toBe(
      true
    );
    expect(
      (
        await sanitizePayload(
          { name: 'John Smith', password: 'short' },
          { sanitizerOptions: { structured: 'json' } }
        )
      ).password
    ).toBe('[REDACTED]');
  });
  it('streams JSONL through the CLI with structural metadata', async () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    const records = [
      JSON.stringify({ name: 'Read', content: 'passport 58 39 204716' }),
      JSON.stringify({ type: 'tool_result', content: 'born 1985-12-07' }),
    ];
    let stdout = '',
      stderr = '';
    const code = await runCli(
      ['redact', '-', '--jsonl', '--stream', '--native-only'],
      {
        stdin: [records.join('\n')],
        stdout: {
          write(value) {
            stdout += value;
          },
        },
        stderr: {
          write(value) {
            stderr += value;
          },
        },
      }
    );
    expect(code).toBe(0);
    expect(stderr).toBe('');
    expect(JSON.parse(stdout.split('\n')[0]).name).toBe('Read');
    expect(JSON.parse(stdout.split('\n')[1]).content).toBe('born [REDACTED]');
  });
  it('fails closed for malformed JSON and colliding sanitized keys', async () => {
    const engine = createSanitizer({ structured: 'json', secretlint: false });
    for (const input of [
      '{"content":',
      '{"a@example.org":1,"b@example.org":2}',
    ]) {
      let failed = false;
      try {
        await engine.sanitize(input);
      } catch {
        failed = true;
      }
      expect(failed).toBe(true);
    }
  });
});

describe('structured publication boundaries', () => {
  it('preserves repeated escaped quotes and JSON punctuation inside strings', () => {
    const value = '\\"{},:[]'.repeat(512);
    const input = JSON.stringify({ value, nested: [{ same: 'plain' }] });
    expect(sanitize(input, { structured: 'json', decode: false }).text).toBe(
      input
    );
  });
  it('does not treat quoted key-like text inside a value as colliding keys', () => {
    const input = JSON.stringify({
      payload: '"same":1,"same":2',
      same: 'plain',
    });
    expect(sanitize(input, { structured: 'json' }).text).toBe(input);
  });
  it('preserves primitive JSON values, source escaping, offsets and original size limits', async () => {
    const input =
      '{"escaped":"DOB \\u0030\\u0032/03/1990","value":42,"ok":true,"empty":null}';
    const result = await createSanitizer({
      structured: 'json',
      secretlint: false,
    }).sanitize(input);
    const parsed = JSON.parse(result.text);
    expect(parsed.value).toBe(42);
    expect(parsed.ok).toBe(true);
    expect(parsed.empty).toBe(null);
    expect(parsed.escaped.includes('1990')).toBe(false);
    expect(
      result.findings.every(
        (f) => f.start >= 0 && f.end <= input.length && !Object.hasOwn(f, 'raw')
      )
    ).toBe(true);
    expect(
      sanitize('"plain"', { structured: 'json', maxInputLength: 7 }).text
    ).toBe('"plain"');
  });
  it('uses structured policies and oversized fallback in bounded worker file publication', async () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    const directory = await mkdtemp(join(tmpdir(), 'identity-session-'));
    try {
      const source = join(directory, 'session.jsonl'),
        target = join(directory, 'safe.jsonl');
      const record = {
        id: 'toolu_01CM9SwFYXq3vJ6cjYAFFjkf',
        name: 'Read',
        content: 'born 1985-12-07',
        url: `https://example.org/?q=${'word%20'.repeat(2000)}`,
      };
      await writeFile(source, `${JSON.stringify(record)}\n`);
      await sanitizeFileBounded(source, target, {
        sanitizerOptions: {
          structured: 'jsonl',
          structuralFields: ['id', 'name'],
        },
      });
      const parsed = JSON.parse(await readFile(target, 'utf8'));
      expect(parsed.id).toBe(record.id);
      expect(parsed.name).toBe('Read');
      expect(parsed.content).toBe('born [REDACTED]');
      expect(parsed.url.includes('word')).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('contextual national phones', () => {
  for (const label of [
    'WhatsApp',
    'Zalo',
    'Viber',
    'Telegram',
    'Signal',
    'WeChat',
    'LINE',
    'KakaoTalk',
    'звоните',
    'пишите',
    'звонить',
    'номер телефона',
  ]) {
    for (const number of [
      '8 912 555 0142',
      '8 (912) 555-01-42',
      '090 123 4567',
      '081 234 5678',
      '0812 3456 7890',
    ]) {
      it(`redacts ${label} national phone ${number}`, () => {
        const input = `${label}: ${number}`;
        expect(sanitize(input).text).toBe(`${label}: [REDACTED]`);
      });
    }
  }
  it('handles adjacent messenger fields and Russian prose', () => {
    const input =
      'Telegram: @rent_agent_x | WhatsApp: 8 912 555 0142\nZalo: 090 123 4567';
    expect(sanitize(input).text).toBe(
      'Telegram: [REDACTED] | WhatsApp: [REDACTED]\nZalo: [REDACTED]'
    );
    expect(sanitize('Сергей, звоните 8 912 555 0142').text).toBe(
      'Сергей, звоните [REDACTED]'
    );
  });
  it('includes parenthesized national area/mobile groups in the phone span', () => {
    for (const number of [
      '(090) 123-4567',
      '(02) 123-4567',
      '(0812) 3456-7890',
    ]) {
      expect(sanitize(`WhatsApp: ${number}`).text).toBe('WhatsApp: [REDACTED]');
    }
  });
  it('keeps tool-call/thread IDs and timestamps', () => {
    const input = 'call_89125550142abc thread_0901234567 2026-10-08T10:12:30Z';
    expect(sanitize(input).text).toBe(input);
  });
});
