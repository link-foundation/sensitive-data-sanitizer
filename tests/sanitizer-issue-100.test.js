import { describe, it, expect } from 'test-anywhere';
import { sanitize, createSanitizer } from '../src/index.js';

const options = { profile: 'documents' };
function both(input, expected) {
  expect(sanitize(input, options).text).toBe(expected);
  const source = JSON.stringify({ note: input });
  expect(sanitize(source, { ...options, structured: 'json' }).text).toBe(
    JSON.stringify({ note: expected })
  );
}

describe('issues 91 and 94 document regressions', () => {
  for (const [input, expected] of [
    ['Компания: Ромашка Лютик', 'Компания: [REDACTED]'],
    ['Работодатель: Ромашка Лютик', 'Работодатель: [REDACTED]'],
    [
      'Место работы: Ромашка Лютик, менеджер',
      'Место работы: [REDACTED], менеджер',
    ],
    ['Employer: Romashka Lyutik', 'Employer: [REDACTED]'],
    ['Company: Romashka Lyutik', 'Company: [REDACTED]'],
    ['Education: МГУ', 'Education: [REDACTED]'],
    ['С уважением,\nАнна', 'С уважением,\n[REDACTED]'],
    ['учился в МГУ', 'учился в [REDACTED]'],
    ['Соискатель: Абвгде Жзиклм', 'Соискатель: [REDACTED]'],
    ['Сотрудник: Абвгде Жзиклм', 'Сотрудник: [REDACTED]'],
    ['контакт: 89161234567', 'контакт: [REDACTED]'],
    ['пишите, 79161234567', 'пишите, [REDACTED]'],
    ['89161234567', '[REDACTED]'],
    ['работал в компании «Ромашка Лютик»', 'работал в компании [REDACTED]'],
    ['работал в компании Ромашка.', 'работал в компании [REDACTED].'],
    ['сильный опыт (Ромашка Лютик)', 'сильный опыт ([REDACTED])'],
    ['опыт в Romashka и Lyutik', 'опыт в [REDACTED] и [REDACTED]'],
    ['Роль в Romashka: руководитель', 'Роль в [REDACTED]: руководитель'],
    [
      'проекты для Ромашка, Лютик и Василек',
      'проекты для [REDACTED], [REDACTED] и [REDACTED]',
    ],
    [
      'Romashka (2 года), Lyutik (3 года)',
      '[REDACTED] (2 года), [REDACTED] (3 года)',
    ],
  ]) {
    it(`redacts in text and JSON: ${input}`, () => both(input, expected));
  }
  for (const input of [
    'Директор, руководитель отдела, Ромашка (2019 – 2021)',
    'Директор (продажи), Ромашка (2019 – 2021)',
    'Менеджер / руководитель, Ромашка (2019 – 2021)',
    'Менеджер, ГК «Ромашка» (2019 – 2021)',
    'Менеджер, Ромашка, ООО (2019 – 2021)',
    'Менеджер, Ромашка,ООО (2019 – 2021)',
    'Менеджер, Ромашка,   Москва (2019 – 2021)',
    'Менеджер, Ромашка, Москва (2019 – 2021)',
    'Менеджер, Ромашка (Москва) (2019 – 2021)',
    'Менеджер, Ромашка (2019-01-01 — )',
    'Менеджер, Ромашка (2019-01-01 — null)',
    'Менеджер, Ромашка (2019 – 2021); Директор, Лютик (2021 – 2023)',
    'Менеджер, Ромашка (2019 – 2021), Директор, Лютик (2021 – 2023)',
    'Ромашка, менеджер (2019-01-01 — 2021-05-31)',
    'Менеджер | Ромашка | 2019-01-01 — 2021-05-31',
  ]) {
    it(`removes all employers: ${input}`, () => {
      for (const structured of [false, true]) {
        const result = sanitize(
          structured ? JSON.stringify({ note: input }) : input,
          { ...options, structured: structured ? 'json' : undefined }
        ).text;
        expect(result.includes('Ромашка')).toBe(false);
        expect(result.includes('Лютик')).toBe(false);
        if (structured) {
          JSON.parse(result);
        }
      }
    });
  }
  for (const input of [
    'Дети: нет\nуровень: info',
    'Опыт: 3 года, 5 месяцев',
    'Директор, руководитель отдела',
    'order 89161234567 shipped',
    'id 79161234567',
    'https://example.org/docs/getting-started',
    'https://github.com/',
    'Встреча в понедельник с Романом',
    'Использовал Kubernetes и PostgreSQL',
    'Менеджер, Ромашка Лютик',
    '- Ромашка Лютик 5 лет',
    'Последнее место работы Ромашка Лютик',
    'портфолио https://ivan-petrov.example.org/',
  ]) {
    it(`preserves controls and documented ambiguous limits: ${input}`, () =>
      both(input, input));
  }
  for (const path of ['/profile/abc123def', '/users/abc123def']) {
    it(`detects personal paths under every label: ${path}`, () => {
      both(`https://example.org${path}`, '[REDACTED]');
      for (const field of ['link', 'target', 'url']) {
        const result = sanitize(
          JSON.stringify({ [field]: `https://example.org${path}` }),
          { ...options, structured: 'json' }
        ).text;
        expect(JSON.parse(result)[field]).toBe('[REDACTED]');
      }
    });
  }
  for (const [query, expected] of [
    ['email=anna.smirnova%40example.org', 'email=[REDACTED]'],
    ['email=anna.smirnova@example.org', 'email=[REDACTED]'],
    ['phone=%2B79161234567', 'phone=[REDACTED]'],
    ['phone=+79161234567', 'phone=[REDACTED]'],
  ]) {
    it(`retains query context: ${query}`, () => {
      both(
        `https://example.org/p?${query}`,
        `https://example.org/p?${expected}`
      );
      both(`GET /login?${query} 200`, `GET /login?${expected} 200`);
    });
  }
  for (const link of [
    'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345/view?usp=sharing',
    'https://docs.google.com/document/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345/edit',
    'https://example.org/s/9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e',
  ]) {
    it(`removes opaque share links: ${link}`, () => {
      const output = sanitize(link, options).text;
      expect(output.includes('1aBcDe')).toBe(false);
      expect(output.includes('9a8b7c')).toBe(false);
      both(link, output);
    });
  }
});

describe('structured document field policy', () => {
  for (const [field, value] of [
    ['firstName', 'Анна'],
    ['lastName', 'Смирнова'],
    ['middleName', 'Викторовна'],
    ['middle_name', 'Викторовна'],
    ['patronymic', 'Викторовна'],
    ['birthday', '1991-03-12'],
    ['birth_date', '1991-03-12T00:00:00.000Z'],
    ['sex', 'F'],
    ['citizenship', 'Казахстан'],
    ['nationality', 'Казахстан'],
    ['company', 'Ромашка'],
    ['companyName', 'Ромашка'],
    ['employer', 'Ромашка'],
    ['university', 'КФУ'],
    ['school', 'Школа 5'],
    ['contact', '89161234567'],
    ['resume_url', 'https://example.org/doc/abc'],
    ['resumeUrl', 'https://example.org/doc/abc'],
    ['alternate_url', 'https://example.org/doc/abc'],
    ['profile_url', 'https://example.org/in/abc'],
    ['company_url', 'https://romashka.example.org'],
  ]) {
    it(`redacts the complete ${field} field`, async () => {
      const input = JSON.stringify({ [field]: value });
      const expected = JSON.stringify({ [field]: '[REDACTED]' });
      expect(sanitize(input, { ...options, structured: 'json' }).text).toBe(
        expected
      );
      expect(
        (
          await createSanitizer({
            ...options,
            structured: 'json',
            secretlint: false,
          }).sanitize(input)
        ).text
      ).toBe(expected);
    });
  }
  it('supports exact caller-declared properties with any JSON value in JSON and JSONL', async () => {
    for (const value of [
      'private words\nsecond line',
      '',
      123,
      false,
      null,
      { nested: 'private', other: ['value'] },
      ['private', 1],
    ]) {
      for (const structured of ['json', 'jsonl']) {
        const input = JSON.stringify({
          privateNote: value,
          PrivateNote: 'keep',
          metadata: 42,
        });
        const config = {
          structured,
          sensitiveFields: ['privateNote'],
          structuralFields: ['privateNote'],
        };
        const expected = JSON.stringify({
          privateNote: '[REDACTED]',
          PrivateNote: 'keep',
          metadata: 42,
        });
        expect(sanitize(input, config).text).toBe(expected);
        expect(
          (
            await createSanitizer({ ...config, secretlint: false }).sanitize(
              input
            )
          ).text
        ).toBe(expected);
      }
    }
  });
  it('keeps declared value replacement valid around overlapping credentials and encoded findings', async () => {
    const config = {
      structured: 'json',
      sensitiveFields: ['custom'],
      transformation: { mode: 'mask', keepStart: 4 },
    };
    const input = JSON.stringify({
      custom: {
        password: 'private-value-123',
        note: '"\\",ООО\\\\\\"Р\\\\\\"\\""',
      },
      ok: true,
    });
    const expected = '{"custom":"[REDACTED]","ok":true}';
    expect(sanitize(input, config).text).toBe(expected);
    expect(
      (await createSanitizer({ ...config, secretlint: false }).sanitize(input))
        .text
    ).toBe(expected);
  });
  it('applies declarations to nested properties and arrays without changing whitespace', () => {
    const input =
      ' { "items": [{ "custom": "private" }, { "custom": 42 }], "ok": true } ';
    const config = { structured: 'json', sensitiveFields: ['custom'] };
    const expected =
      ' { "items": [{ "custom": "[REDACTED]" }, { "custom": "[REDACTED]" }], "ok": true } ';
    expect(sanitize(input, config).text).toBe(expected);
    expect(sanitize(expected, config).text).toBe(expected);
  });
  it('rejects malformed sensitiveFields configuration', () => {
    for (const sensitiveFields of ['custom', [1], ['']]) {
      let code;
      try {
        sanitize('{}', { structured: 'json', sensitiveFields });
      } catch (error) {
        code = error.code;
      }
      expect(code).toBe('ERR_CONFIG');
    }
  });
  it('supports synchronous custom values through knownPersonal', () => {
    expect(
      sanitize('Lyutik работал', {
        ...options,
        knownPersonal: [{ value: 'Lyutik', type: 'ORGANIZATION' }],
      }).text
    ).toBe('[REDACTED] работал');
  });
  it('redacts an escaped sensitive fragment while retaining a parseable record', async () => {
    const input = JSON.stringify({
      output: '"\\",ООО\\\\\\"Р\\\\\\"\\""',
      metadata: 'keep',
    });
    const config = { ...options, structured: 'json' };
    for (const output of [
      sanitize(input, config).text,
      (await createSanitizer({ ...config, secretlint: false }).sanitize(input))
        .text,
    ]) {
      const parsed = JSON.parse(output);
      expect(parsed.metadata).toBe('keep');
      expect(parsed.output.includes('ООО')).toBe(false);
      expect(parsed.output.includes('[REDACTED]')).toBe(true);
    }
  });
});
