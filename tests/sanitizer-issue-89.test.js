import { URL } from 'node:url';
import { collectMatches } from '../src/detection.js';
import { describe, it, expect } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import { sanitize, inspect, createSanitizer, restore } from '../src/index.js';

const options = { profile: 'documents' };
const issue88 = JSON.parse(
  readFileSync(
    new URL('../experiments/issue-89/issue-88.json', import.meta.url)
  )
);
const variants = [...issue88.body.matchAll(/^\| `([^`]+)` \|/gm)].map(
  (m) => m[1]
);
const durations = [
  'опыт работы 5 лет',
  'стаж 12 лет',
  '3 года опыта',
  'за последние 3 года',
  'более 10 лет',
  'через 5 лет',
  'договор на 3 года',
  'Проект длился 2 года',
  'Задача выполнена за 3 года',
];
const stack =
  'Error: connect ECONNREFUSED 127.0.0.1:5432\n    at TCPConnectWrap.afterConnect (node:net:1595:16)';
const safeStack =
  'Error: boom\n    at f (/app/src/index.ts:10:5)\n    at async g (node:internal/process/task_queues:95:5)';
const keep = [
  ...durations,
  stack,
  safeStack,
  'Гражданство: не указано',
  'Дети: нет',
  'Пол: не указан',
  'возраст: не указан',
  'Срок 34 дня',
  'Пол деревянный',
  'Статус: открыт',
  '34 года',
  'Server listening at http://0.0.0.0:3000',
  'http://localhost:3000/api/v1/items',
  '127.0.0.1',
];
const payloads = [
  '926 765 4321',
  '8 926 7654321',
  'petr.kuznetsov',
  'petr_kuz',
  'petr.kuz',
  'ТП УФМС Перми 05.06.2015',
  '40817810500000000123',
  'Кузнецов',
  '1985',
  '1985',
  '41',
  '41',
  'Ж',
  'М',
  'жен.',
  'муж.',
  'РФ',
  'двое детей',
  'Перми',
  '9267654321',
  'petr.kuznetsov',
  'petr_kuz',
  '1985',
  '41',
  '41',
  'женский',
  'Перми',
  'Лебедева',
  'Vasilek',
  'Vasilek',
  'MSU',
  'Цой',
  'Ким',
  'Шевченко',
];
const ages = [
  'мне 29 лет',
  'возраст: 34',
  'Женщина, 34 года',
  'Мне 34',
  'исполнилось 34',
  'Мужчина, 41 год',
];

for (const structured of [undefined, 'json', 'jsonl']) {
  describe(`issues 87/88 (${structured ?? 'text'})`, () => {
    const config = { ...options, ...(structured ? { structured } : {}) };
    const wrap = (value) =>
      structured ? JSON.stringify({ note: value }) : value;
    for (const value of keep) {
      it(`keeps ${value}`, () => {
        const input = wrap(value);
        expect(sanitize(input, config).text).toBe(input);
      });
    }
    for (const value of variants.concat(ages)) {
      it(`removes ${value}`, () => {
        const input = wrap(value);
        const output = sanitize(input, config).text;
        expect(output === input).toBe(false);
        const payload = payloads[variants.indexOf(value)];
        if (payload) {
          const decoded = structured ? JSON.parse(output).note : output;
          expect(decoded.includes(payload)).toBe(false);
        }
        const result = sanitize(input, {
          ...config,
          transformation: { mode: 'placeholder' },
        });
        expect(restore(result.text, result.map)).toBe(input);
      });
    }
  });
}
for (const structured of ['json', 'jsonl']) {
  it(`redacts all personal path families under url in ${structured}`, () => {
    for (const prefix of [
      'u',
      'in',
      'user',
      'users',
      'profile',
      'member',
      'home',
      'people',
    ]) {
      const input = JSON.stringify({ url: `/${prefix}/petr.kuz` });
      expect(
        JSON.parse(sanitize(input, { ...options, structured }).text).url
      ).toBe('[REDACTED]');
    }
    expect(
      JSON.parse(
        sanitize(JSON.stringify({ url: '/in/petr-kuz' }), {
          ...options,
          structured,
        }).text
      ).url
    ).toBe('[REDACTED]');
    const input = JSON.stringify({ url: '/api/v1/items' });
    expect(sanitize(input, { ...options, structured }).text).toBe(input);
  });
  it(`keeps asynchronous native behavior consistent for ${structured}`, async () => {
    const config = { ...options, structured, secretlint: false };
    const input = JSON.stringify({
      keep,
      remove: variants.concat(ages),
      url: '/u/petr.kuz',
    });
    expect((await createSanitizer(config).sanitize(input)).text).toBe(
      sanitize(input, config).text
    );
  });
}
it('preserves private overrides for bind addresses', () => {
  expect(
    sanitize('0.0.0.0', {
      knownPersonal: [{ type: 'IP_ADDRESS', value: '0.0.0.0' }],
    }).text
  ).toBe('[REDACTED]');
  expect(sanitize('0.0.0.0', { publicKnowledge: false }).text).toBe(
    '[REDACTED]'
  );
});
it('keeps meaningful negative attributes sensitive', () => {
  for (const value of ['инвалидность: нет', 'судимость: нет']) {
    expect(sanitize(value, options).text).toBe(
      `${value.split(':')[0]}: [REDACTED]`
    );
  }
});
it('reports exact age spans and preserves units', () => {
  const input = 'Женщина, 34 года';
  expect(
    inspect(input, options).some(
      (f) => f.type === 'AGE' && input.slice(f.start, f.end) === '34'
    )
  ).toBe(true);
  expect(sanitize(input, options).text).toBe('[REDACTED], [REDACTED] года');
});

it('protects personal paths in text labels as well as structured fields', () => {
  for (const path of ['/u/petr.kuz', '/in/petr-kuz']) {
    expect(sanitize(`url: ${path}`, options).text).toBe('url: [REDACTED]');
  }
});

it('isolates match iteration and resets pre-used expressions', () => {
  for (const pattern of [/private/g, /private/]) {
    pattern.lastIndex = 8;
    const found = [];
    collectMatches('private private', pattern, (f) => found.push(f.start), {
      type: 'SECRET',
      category: 'credential',
      rule: 'test',
    });
    expect(found).toEqual([0, 8]);
    expect(pattern.lastIndex).toBe(8);
  }
  const pattern = /private/g;
  const found = [];
  collectMatches(
    'private private',
    pattern,
    (f) => {
      found.push(f.start);
      collectMatches('private', pattern, () => {}, {
        type: 'SECRET',
        category: 'credential',
        rule: 'test',
      });
    },
    { type: 'SECRET', category: 'credential', rule: 'test' }
  );
  expect(found).toEqual([0, 8]);
  expect(pattern.lastIndex).toBe(0);
});
