import { describe, it, expect } from 'test-anywhere';
import { sanitize, createSanitizer } from '../src/index.js';

const dates = '(2019-05-01 — 2021-03-01)';
const options = { profile: 'documents' };
const cases = [
  ...[
    'Менеджер',
    'Маркетолог',
    'Архивариус',
    'Сценограф',
    'Cartographer',
    'Marketer',
  ].flatMap((title) =>
    [
      'Ромашка, Лютик',
      'Ромашка (Лютик)',
      'Romashka, LLC',
      'Ромашка / Лютик',
    ].map((company) => [
      `${title}, ${company} ${dates}`,
      `${title}, [REDACTED] ${dates}`,
    ])
  ),
  ...[
    'Основатель, консультант',
    'Founder, consultant',
    'Маркетолог (B2B)',
    'Опыт: директор, основатель',
    'Опыт работы: Менеджер, консультант',
    'Опыт: менеджер (b2b)',
    'Стаж = 5 лет: Менеджер',
    '= 3 года, Менеджер',
  ].map((title) => [
    `${title}, Ромашка ${dates}`,
    `${title}, [REDACTED] ${dates}`,
  ]),
  [
    `Менеджер, Лютик ${dates}. Директор, Ромашка ${dates}`,
    `Менеджер, [REDACTED] ${dates}. Директор, [REDACTED] ${dates}`,
  ],
  [
    `Менеджер, Ромашка | маркетинг, продажи ${dates}`,
    `Менеджер, [REDACTED] | маркетинг, продажи ${dates}`,
  ],
  [
    `Менеджер, Ромашка Лютик | IT, связь ${dates}`,
    `Менеджер, [REDACTED] | IT, связь ${dates}`,
  ],
  [
    `Маркетолог, ГК «Ромашка Лютик» ${dates}`,
    `Маркетолог, [REDACTED] ${dates}`,
  ],
  [`ГК «Ромашка» ${dates}`, `[REDACTED] ${dates}`],
  ['ГК Ромашка, менеджер', '[REDACTED], менеджер'],
  ['группа компаний Ромашка', '[REDACTED]'],
  ['Группа компаний "ромашка лютик"', '[REDACTED]'],
  ['ГК “Ромашка Лютик”', '[REDACTED]'],
  [
    'Анна работала в Лютике, потом в Ромашке, затем в Васильке.',
    'Анна работала в [REDACTED], потом в [REDACTED], затем в [REDACTED].',
  ],
  [
    'Анна работала в Blue Sky, потом в Acme Labs.',
    'Анна работала в [REDACTED], потом в [REDACTED].',
  ],
  [
    'Анна работала в Лютике, потом в Ромашке.',
    'Анна работала в [REDACTED], потом в [REDACTED].',
  ],
  ...['Анна', 'Anna', 'Письмо', 'Letter'].map((lead) => [
    `${lead}, 89161234567, жду ответа`,
    `${lead}, [REDACTED], жду ответа`,
  ]),
  ['Анна, 89161234567', 'Анна, [REDACTED]'],
  ['Anna, 89161234567', 'Anna, [REDACTED]'],
  [
    'Letter, 89161234567, waiting for a reply',
    'Letter, [REDACTED], waiting for a reply',
  ],
  ['Иванова А., 79161234567, Москва', '[REDACTED], [REDACTED], [REDACTED]'],
  ['(МГУ, 2012)', '([REDACTED], 2012)'],
  ['Образование (МГУ)', 'Образование ([REDACTED])'],
  ['в МГТУ им. Баумана', 'в [REDACTED]'],
  ['Обучение: Skillbox, 2020', 'Обучение: [REDACTED], 2020'],
  ...[
    'https://drive.google.com/file/d/1aBcDeFgHiJkLmNo/view?usp=sharing',
    'https://docs.example.org/document/d/1AbCdEf/edit',
    'https://any.example/d/x',
  ].map((link) => [link, '[REDACTED]']),
];
const controls = [
  'Опыт: 3 года, 5 месяцев',
  'Директор, руководитель отдела',
  `Встреча, понедельник ${dates}`,
  `Отпуск ${dates}`,
  'order 89161234567 shipped',
  'id 79161234567',
  'Встреча в понедельник с Романом',
  'Использовал Kubernetes и PostgreSQL',
  'опыт в Python и Go',
  'опыт в SQL, Excel и Power BI',
  'Kubernetes (5 лет)',
  'Python (2 года), Go (3 года)',
  'проекты для Telegram',
  'Роль в Scrum: мастер',
  `Релиз, Kubernetes ${dates}`,
  ...['Менеджер, romashka', 'Менеджер, ромашка', 'Manager, romashka'].map(
    (s) => `${s} ${dates}`
  ),
];

describe('issue 104 complete reported document forms', () => {
  for (const [input, expected] of [...cases, ...controls.map((s) => [s, s])]) {
    it(`text and JSON: ${input}`, () => {
      expect(sanitize(input, options).text).toBe(expected);
      expect(
        sanitize(JSON.stringify({ note: input }), {
          ...options,
          structured: 'json',
        }).text
      ).toBe(JSON.stringify({ note: expected }));
    });
  }
  it('normalizes declared sensitive names and keeps relative location paths', async () => {
    expect(sanitize('{"location":"apps/api"}').text).toBe(
      '{"location":"apps/api"}'
    );
    const input =
      '{"fooBar":"Иван","foo_bar":{"private":42},"FooBar":123,"foo-bar":false,"location":"apps/api","ok":42}';
    const config = {
      structured: 'json',
      sensitiveFields: ['fooBar'],
    };
    const expected =
      '{"fooBar":"[REDACTED]","foo_bar":"[REDACTED]","FooBar":"[REDACTED]","foo-bar":"[REDACTED]","location":"apps/api","ok":42}';
    expect(sanitize(input, config).text).toBe(expected);
    expect(
      (await createSanitizer({ ...config, secretlint: false }).sanitize(input))
        .text
    ).toBe(expected);
  });
});

const proseOptions = { ...options, properNames: 'capitalized' };
const proseCases = [
  [
    'Работал в Ромашке менеджером по продажам.',
    '[REDACTED] в [REDACTED] менеджером по продажам.',
  ],
  ['Опыт: работал в Ромашке 5 лет', 'Опыт: работал в [REDACTED] 5 лет'],
  [
    `Маркетолог, ГК «ромашка лютик» ${dates}`,
    `[REDACTED], [REDACTED] [REDACTED] ${dates}`,
  ],
  [
    'Founder, consultant, Romashka (2019-2021)',
    '[REDACTED], consultant, [REDACTED] (2019-2021)',
  ],
  [
    'Сотрудник работал в Romashka три года.',
    '[REDACTED] работал в [REDACTED] три года.',
  ],
  ['Живу в Твери', '[REDACTED] в [REDACTED]'],
  [
    'текст Санкт-Петербург A.B iPhone eBay',
    'текст [REDACTED] [REDACTED] [REDACTED] [REDACTED]',
  ],
  [
    'текст «ромашка лютик» “лютик” „ромашка“',
    'текст [REDACTED] [REDACTED] [REDACTED]',
  ],
  [
    'текст example.org/path https://other.example/ 89161234567',
    'текст [REDACTED] [REDACTED] [REDACTED]',
  ],
  ['Anna, 89161234567', '[REDACTED], [REDACTED]'],
  ['https://docs.example/d/x Anna', '[REDACTED] [REDACTED]'],
  ['Ромашка: менеджер', '[REDACTED]: менеджер'],
  [
    'Worked at Romashka for three years.',
    'Worked at [REDACTED] for three years.',
  ],
  [
    'текст apps/SomePath /Opt/Apps C:\\Some\\Path Label: слово',
    'текст apps/SomePath /Opt/Apps C:\\Some\\Path Label: слово',
  ],
  ...[
    'Connection to Postgres lost, retrying',
    'order 89161234567 shipped',
    'Window Closed (2026-01-15T10:30:00.000Z)',
    'https://anna-smirnova.example.org/',
    'ромашка работает',
    '1991-03-12',
  ].map((s) => [s, s]),
];
describe('issue 105 opt-in structural prose', () => {
  for (const [input, expected] of proseCases) {
    it(`isolates and repeats: ${input}`, async () => {
      for (const structured of [undefined, 'json', 'jsonl']) {
        const source = structured
          ? JSON.stringify({
              note: input,
              operational: 'Connection to Postgres lost, retrying',
              count: 42,
            })
          : input;
        const output = structured
          ? JSON.stringify({
              note: expected,
              operational: 'Connection to Postgres lost, retrying',
              count: 42,
            })
          : expected;
        const config = { ...proseOptions, structured };
        expect(sanitize(source, config).text).toBe(output);
        expect(sanitize(output, config).text).toBe(output);
        expect(
          (
            await createSanitizer({ ...config, secretlint: false }).sanitize(
              source
            )
          ).text
        ).toBe(output);
      }
    });
  }
  it('is off by default and supports explicitly selected scripts', () => {
    expect(sanitize('Работал в Ромашке', options).text).toBe(
      'Работал в Ромашке'
    );
    expect(
      sanitize('Работал в Ромашке', { ...proseOptions, scripts: [] }).text
    ).toBe('Работал в Ромашке');
    expect(
      sanitize('bonjour Acme', { ...proseOptions, scripts: ['Latin'] }).text
    ).toBe('bonjour [REDACTED]');
    expect(
      sanitize('κείμενο Acme', { ...proseOptions, scripts: ['Greek'] }).text
    ).toBe('κείμενο [REDACTED]');
  });
  it('preserves Unicode and escaped JSON keys and source formatting', () => {
    const input =
      ' { "Ромашка": "текст Acme", "Romashka": 5, "escaped\\u041aey": "Connection to Acme lost" } ';
    expect(sanitize(input, { ...proseOptions, structured: 'json' }).text).toBe(
      ' { "Ромашка": "текст [REDACTED]", "Romashka": 5, "escaped\\u041aey": "Connection to Acme lost" } '
    );
  });
  it('rejects invalid mode/script configuration', () => {
    for (const config of [
      { properNames: true },
      { properNames: 'anything' },
      { scripts: 'Cyrillic' },
      { scripts: [null] },
      { scripts: ['UnknownScript'] },
      { scripts: ['Latin}|.'] },
    ]) {
      let code;
      try {
        sanitize('text', config);
      } catch (error) {
        code = error.code;
      }
      expect(code).toBe('ERR_CONFIG');
    }
  });
});
