import { describe, it, expect } from 'test-anywhere';
import { inspect, sanitize, createSanitizer } from '../src/index.js';

const github = `ghp_${'Ab1cD2'.repeat(6)}`;

describe('sensitive text publication boundary', () => {
  it('keeps complete reviewed public names in labelled prose', () => {
    const input = 'name: Public Person';
    expect(
      sanitize(input, {
        publicEntities: [
          {
            type: 'PERSON',
            value: 'Public Person',
            source: 'https://example.org/about',
            reviewedAt: '2026-10-07',
          },
        ],
      }).text
    ).toBe(input);
  });
  it('fully removes vendor credentials and personal emails without reporting values', () => {
    const input = `Token ${github}; contact private@example.org`;
    const result = sanitize(input);
    expect(result.text).toBe('Token [REDACTED]; contact [REDACTED]');
    expect(result.findings.length).toBe(2);
    expect(JSON.stringify(result.findings).includes(github)).toBe(false);
    expect(
      JSON.stringify(result.findings).includes('private@example.org')
    ).toBe(false);
    expect(sanitize(result.text).text).toBe(result.text);
  });

  it('redacts context even for low entropy passwords while preserving JSON', () => {
    const result = sanitize('{"password":"a b","total_tokens":123,"ok":true}');
    expect(JSON.parse(result.text)).toEqual({
      password: '[REDACTED]',
      total_tokens: 123,
      ok: true,
    });
  });

  it('keeps reviewed public contacts but never allows credentials', () => {
    const options = {
      publicEntities: [
        {
          type: 'EMAIL',
          value: 'press@example.org',
          source: 'https://example.org/contact',
          reviewedAt: '2026-10-07',
        },
      ],
    };
    expect(sanitize('press@example.org', options).text).toBe(
      'press@example.org'
    );
    expect(sanitize('password="press@example.org"', options).text).toBe(
      'password="[REDACTED]"'
    );
  });

  it('unions overlapping detectors so no portion of a secret survives', () => {
    const result = sanitize('abcdefghij', {
      findings: [
        {
          start: 0,
          end: 6,
          type: 'SECRET',
          rule: 'first',
          category: 'credential',
        },
        {
          start: 4,
          end: 10,
          type: 'SECRET',
          rule: 'second',
          category: 'credential',
        },
      ],
    });
    expect(result.text).toBe('[REDACTED]');
  });

  it('detects Unicode labelled names and obscured or encoded credentials', () => {
    expect(sanitize('Имя: Иван Петров').text).toBe('Имя: [REDACTED]');
    expect(sanitize(`${github.slice(0, 8)}\u200b${github.slice(8)}`).text).toBe(
      '[REDACTED]'
    );
    expect(
      sanitize(Buffer.from(`password=${github}`).toString('base64')).text
    ).toBe('[REDACTED]');
  });

  it('fails closed for invalid detector spans and adapter failures without leaking diagnostics', async () => {
    expect(() =>
      inspect('safe', {
        findings: [
          {
            start: 0,
            end: 99,
            type: 'SECRET',
            rule: 'x',
            category: 'credential',
          },
        ],
      })
    ).toThrow();
    const engine = createSanitizer({
      secretlint: false,
      detectors: [
        {
          id: 'broken',
          detect: async () => {
            throw new Error(github);
          },
        },
      ],
    });
    let message = '';
    try {
      await engine.sanitize('safe');
    } catch (error) {
      message = error.message;
    }
    expect(message.includes(github)).toBe(false);
    expect(message.includes('failed')).toBe(true);
  });
});
