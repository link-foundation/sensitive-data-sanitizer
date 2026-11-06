import { describe, it, expect } from 'test-anywhere';
import { sanitize, createSanitizer } from '../src/index.js';

// Original synthetic issue rows, with complete expected spans reviewed by hand.
const catalog = [
  ['тел.: 1234567', 'тел.: [REDACTED]'],
  ['8 9 1 6 1 2 3 4 5 6 7', '[REDACTED]'],
  ['anna(собака)example(точка)org', '[REDACTED]'],
  ['a n n a @ example . org', '[REDACTED]'],
  ['discord: anna#1234', 'discord: [REDACTED]'],
  ['max: anna_s', 'max: [REDACTED]'],
  ...[
    'ok.ru/profile/123456',
    'gitlab.com/anna-s',
    'habr.com/ru/users/anna_s',
    'facebook.com/anna.s',
    'https://example.org/cv/abc123def',
    'https://example.org/~anna/',
    'https://anna.example.org/cv.pdf',
  ].map((s) => [s, '[REDACTED]']),
  ['д.р. 12/03/91', 'д.р. [REDACTED]'],
  ['день рождения 5 мая', 'день рождения [REDACTED]'],
  ['34 y.o.', '[REDACTED]'],
  ['45 лет от роду', '[REDACTED]'],
  ['военный билет АБ 1234567', 'военный билет [REDACTED]'],
  ['VIN WVWZZZ1JZXW000001', 'VIN [REDACTED]'],
  ['ооо ромашка', '[REDACTED]'],
  ['Romashka, manager', '[REDACTED], manager'],
  ['at Romashka', 'at [REDACTED]'],
  ['graduated from MSU', 'graduated from [REDACTED]'],
  ['MIT, 2012', '[REDACTED], 2012'],
  ['anna%40example.org', '[REDACTED]'],
  [
    'https://x.example/?m=anna%40example.org',
    'https://x.example/?m=[REDACTED]',
  ],
  ['YW5uYUBleGFtcGxlLm9yZw==', '[REDACTED]'],
  ...[
    'Ивановна',
    'СМИРНОВА А.В.',
    'Aннa Cмирнoвa',
    'Тимур Ким',
    'Оксана Ковальчук',
    'Ли Вэй',
    'ул Ленина 5-12',
    'пр-т Мира, д. 5',
    'Ленинградское шоссе, 16',
    'Тверская область',
    'Калининский район',
    'А123ВС 77 RUS',
    'Лютик Банк',
    'МГУ',
    'МГУ им. Ломоносова',
  ].map((s) => [s, '[REDACTED]']),
  ['Москва, ул. Тверская, 5', '[REDACTED], [REDACTED]'],
  [
    'Музей находится на ул. Ленина, д. 5, кв. 12',
    'Музей находится на [REDACTED]',
  ],
  ['гражданство РФ', 'гражданство [REDACTED]'],
  ['гражданин Беларуси', 'гражданин [REDACTED]'],
  ['госномер А123ВС77', 'госномер [REDACTED]'],
  ['Компания - Ромашка', 'Компания - [REDACTED]'],
  ['Место работы — Ромашка', 'Место работы — [REDACTED]'],
  ['Группа Ромашка', 'Группа [REDACTED]'],
  ['стартап Ромашка', 'стартап [REDACTED]'],
  ['Ромашка (ритейл)', '[REDACTED] (ритейл)'],
  ['Ромашка, менеджер', '[REDACTED], менеджер'],
  ['Ромашка — менеджер', '[REDACTED] — менеджер'],
  ['менеджер в Ромашке', 'менеджер в [REDACTED]'],
  ['менеджер Ромашки', 'менеджер [REDACTED]'],
  ['ТГУ, 2012', '[REDACTED], 2012'],
  ['бакалавр, ТГУ', 'бакалавр, [REDACTED]'],
  ['диплом ТГУ', 'диплом [REDACTED]'],
  ['колледж Лютик', 'колледж [REDACTED]'],
  ['Курсы Лютик', 'Курсы [REDACTED]'],
  ['курс на Ромашке', 'курс на [REDACTED]'],
  ['Romashka Inc.', '[REDACTED].'],
];
const controls = [
  'опыт работы 10 лет',
  'Стаж 5 лет',
  'order 89161234567 shipped',
  'id 79161234567',
  'Connection to Postgres lost, retrying',
  'commit 9f8e7d6c5b4a39281706f5e4d3c2b1a098765432',
  'listening on 0.0.0.0:3000',
  'at parse (/srv/app/dist/a.js:10:3)',
  'Использовал Kubernetes и PostgreSQL',
  'Встреча в понедельник',
  'Группа разработки выросла',
  'Менеджер по продажам',
  'Курсы повышения квалификации',
  'улица была закрыта',
  'Банк данных обновлён',
  'ОГРНИП',
  'Вчера Анна написала',
  'Сергей',
  'Смирнова',
  'Смирновой',
  'СПб',
  'Питер',
];

async function formats(input, expected, config = {}) {
  for (const structured of [undefined, 'json', 'jsonl']) {
    const source = structured
      ? JSON.stringify({ msg: input, n: 125009, ok: true })
      : input;
    const target = structured
      ? JSON.stringify({ msg: expected, n: 125009, ok: true })
      : expected;
    const options = { profile: 'documents', ...config, structured };
    expect(sanitize(source, options).text).toBe(target);
    expect(
      (
        await createSanitizer({ ...options, secretlint: false }).sanitize(
          source
        )
      ).text
    ).toBe(target);
  }
}

describe('issues 115 and 117 complete catalogs', () => {
  for (const [input, expected] of [
    ...catalog,
    ...controls.map((s) => [s, s]),
  ]) {
    it(input, () => formats(input, expected));
  }
});

describe('issue 116 strict stored-log policy', () => {
  const positives = [
    'женщина',
    'мужчина',
    'замужем',
    'двое детей',
    'русская',
    'православный',
    'инвалидность 2 группы',
    'беременна',
    'судимость погашена',
    'член партии',
    '34 года',
    '12.03.1991',
    '12 марта 1991',
    '1991-03-12',
    '45 10 123456',
    '4510123456',
    '9161234567',
    '125009',
    'pregnant',
    'married',
    'muslim',
    'criminal record',
    'party member',
    'two children',
  ];
  for (const input of positives) {
    it(`strict: ${input}`, async () => {
      await formats(input, '[REDACTED]', { strict: true });
      expect(
        sanitize(input, { profile: 'documents', strict: false }).text
      ).toBe(input);
    });
  }
  it('redacts both family attributes', () =>
    formats('женат, двое детей', '[REDACTED], [REDACTED]', { strict: true }));
  for (const input of [
    'опыт работы 10 лет',
    'Стаж 5 лет',
    '2026-01-15T10:30:00.000Z',
    'request took 9161234567 ns',
    'Дети: нет',
  ]) {
    it(`strict control: ${input}`, () =>
      formats(input, input, { strict: true }));
  }
  it('preserves structural strings and numeric JSON leaves', async () => {
    const input =
      '{"meta":"1991-03-12","n":9161234567,"ok":true,"note":"125009"}';
    const options = {
      strict: true,
      structured: 'json',
      structuralFields: ['meta'],
    };
    const expected =
      '{"meta":"1991-03-12","n":9161234567,"ok":true,"note":"[REDACTED]"}';
    expect(sanitize(input, options).text).toBe(expected);
    expect(
      (await createSanitizer({ ...options, secretlint: false }).sanitize(input))
        .text
    ).toBe(expected);
  });
});
