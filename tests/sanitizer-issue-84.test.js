import { describe, it, expect } from 'test-anywhere';
import { sanitize, inspect, restore, createSanitizer } from '../src/index.js';
import { rows } from '../experiments/issue-84/rows.mjs';

const options = { profile: 'documents' };
const keep = [
  '34 года',
  'серия тестов 3 номер 5',
  'Версия 1991',
  'Уровень 3',
  'skype недоступен',
  'доб. молока',
  'карта сайта',
  'Срок 34 дня',
  'Пол деревянный',
  'пол часа',
  'компания выросла на 34%',
  'Россия заняла 3 место',
  'Спасибо, команда!',
  'м. б. завтра',
  'диплом проекта',
  'группа 2',
  'обед в 12',
  'https://github.com/',
  'зарплата 150 000 руб.',
  'Salary: 150000',
];
const hash = '9f8e7d6c5b4a39281706f5e4d3c2b1a098765432';

describe('document forms and structured value boundaries', () => {
  for (const { issue, input, limit } of rows) {
    if (limit || input === '34 года') {
      continue;
    }
    it(`#${issue}: ${input}`, () => {
      const output = sanitize(input, options).text;
      expect(output === input).toBe(false);
      // Partial redaction must never leave the identifying numeric payload.
      if (issue === 81) {
        expect(/anna|123456|770-001|ОВД|345678|408178/.test(output)).toBe(
          false
        );
      }
      if (issue === 80) {
        expect(/\d/.test(output)).toBe(false);
      }
    });
  }
  for (const input of keep.concat(
    rows
      .filter((r) => r.limit && r.input !== 'Лютик, менеджер')
      .map((r) => r.input)
  )) {
    it(`preserves ordinary text / documented limit: ${input}`, () => {
      expect(sanitize(input, options).text).toBe(input);
    });
  }
  it('covers the formerly ambiguous reversed employer cue requested by issue 117', () => {
    expect(sanitize('Лютик, менеджер', options).text).toBe(
      '[REDACTED], менеджер'
    );
  });
  for (const structured of ['json', 'jsonl']) {
    it(`#77: scans each decoded ${structured} value at line start`, () => {
      const line = 'Менеджер, Ромашка (2019 – 2021)';
      for (const value of [
        { note: line },
        { list: [line] },
        { note: `${line}\nвторая строка` },
        { note: `первая строка\n${line}` },
        { payload: JSON.stringify({ note: line }) },
        {
          payload: JSON.stringify({ payload: JSON.stringify({ note: line }) }),
        },
        { note: 'Менеджер (Ромашка), 2019–2021' },
      ]) {
        const text = JSON.stringify(value);
        const output = sanitize(text, { ...options, structured }).text;
        JSON.parse(output);
        expect(output.includes('Ромашка')).toBe(false);
      }
      const safe = '{ "note" : "plain\\ntext", "count":2, "nil":null }';
      expect(sanitize(safe, { ...options, structured }).text).toBe(safe);
    });
    it(`handles all nonambiguous issue rows in ${structured} leaves`, () => {
      const values = rows.filter((r) => !r.limit && r.input !== '34 года');
      const output = JSON.parse(
        sanitize(JSON.stringify(values.map((r) => r.input)), {
          ...options,
          structured,
        }).text
      );
      for (let i = 0; i < values.length; i++) {
        expect(output[i] === values[i].input).toBe(false);
        if (values[i].issue === 80) {
          expect(/\d/.test(output[i])).toBe(false);
        }
      }
    });
    it(`#79: retains operational ${structured} values consistently`, () => {
      const text = JSON.stringify({
        url: '/api/v1/items',
        path: '/api/v1/items',
        time: '2026-01-15T10:30:00.000Z',
        timestamp: '2026-01-15T10:30:00.000Z',
        commit: hash,
        note: hash,
        message: `commit ${hash}`,
      });
      expect(sanitize(text, { ...options, structured }).text).toBe(text);
    });
    it('preserves offsets and supports restoration of escaped value findings', () => {
      const text =
        '{"note":"Менеджер, \\u0420омашка (2019 – 2021)","safe":"a\\tb"}';
      const result = sanitize(text, {
        ...options,
        structured,
        transformation: { mode: 'placeholder' },
      });
      JSON.parse(result.text);
      expect(restore(result.text, result.map)).toBe(text);
      const findings = inspect(text, { ...options, structured });
      expect(
        findings.some((f) => text.slice(f.start, f.end).includes('омашка'))
      ).toBe(true);
    });
  }
  it('#79: retains operational prose and quoted hashes but removes contextual secrets', () => {
    for (const input of [
      `url: /api/v1/items`,
      'time: 2026-01-15T10:30:00.000Z',
      hash,
      `commit ${hash}`,
      `"${hash}"`,
    ]) {
      expect(sanitize(input, options).text).toBe(input);
    }
    for (const url of [
      ['https://user', 'pass@example.org/'].join(':'),
      'https://example.org/?token=private-value',
      'https://vk.com/ivan.petrov91',
      '/users/anna',
    ]) {
      expect(sanitize(`url: ${url}`, options).text.includes(url)).toBe(false);
    }
    expect(sanitize(`token: ${hash}`, options).text.includes(hash)).toBe(false);
  });
});

it('uses the same document coverage in the asynchronous API', async () => {
  const input = 'тел.: 8-916-123-45-67';
  expect((await createSanitizer(options).sanitize(input)).text).toBe(
    sanitize(input, options).text
  );
});
it('applies standalone structured views to asynchronous native and external engines', async () => {
  const line = 'Менеджер, Ромашка (2019 – 2021)';
  for (const structured of ['json', 'jsonl']) {
    const text = JSON.stringify({ note: line });
    expect(
      (
        await createSanitizer({
          ...options,
          structured,
          secretlint: false,
        }).sanitize(text)
      ).text
    ).toBe(sanitize(text, { ...options, structured }).text);
    const detector = {
      detect: (value) =>
        value.startsWith('private phrase')
          ? [
              {
                start: 0,
                end: 14,
                type: 'SECRET',
                category: 'credential',
                rule: 'custom-anchor',
                confidence: 1,
              },
            ]
          : [],
    };
    const result = await createSanitizer({
      structured,
      secretlint: false,
      detectors: [detector],
    }).sanitize('{"note":"private phrase"}');
    expect(result.text).toBe('{"note":"[REDACTED]"}');
  }
});
