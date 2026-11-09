import { describe, it, expect } from 'test-anywhere';
import {
  createSyncSanitizer,
  createSanitizer,
  inspect,
  restore,
} from '../src/index.js';

const options = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  secretlint: false,
};
const reported = [
  ['ivan [at] example [dot] org', '[REDACTED]'],
  ['ivan (at) example (dot) org', '[REDACTED]'],
  ['ivan собака example.org', '[REDACTED]'],
  ['пишите ivan[at]example.org', 'пишите [REDACTED]'],
  ['военный билет АБ 1234567', 'военный билет [REDACTED]'],
  ['работал в ромашке три года', 'работал в [REDACTED] три года'],
  ['Ромашка: менеджер', '[REDACTED]: менеджер'],
  ['Стаж: 5 лет', 'Стаж: 5 лет'],
  ['работал там 5 лет', 'работал там 5 лет'],
  ['Kubernetes (5 лет)', '[REDACTED] (5 лет)'],
];

for (const structured of [undefined, 'json', 'jsonl']) {
  describe(`issue 120 exact rows (${structured ?? 'text'})`, () => {
    const config = { ...options, structured };
    const wrap = (value) =>
      structured ? JSON.stringify({ note: value, n: 42 }) : value;
    for (const [input, expected] of reported) {
      it(input, async () => {
        const source = wrap(input),
          target = wrap(expected);
        expect(createSyncSanitizer(config).sanitize(source).text).toBe(target);
        expect((await createSanitizer(config).sanitize(source)).text).toBe(
          target
        );
        expect(createSyncSanitizer(config).sanitize(target).text).toBe(target);
      });
    }
  });
}

describe('issue 120 age and duration boundaries', () => {
  for (const [input, expected] of [
    ['кандидату 34 года', 'кандидату [REDACTED]'],
    ['мне 34 года', 'мне [REDACTED]'],
    ['возраст 41', 'возраст [REDACTED]'],
    ['34 года', '[REDACTED]'],
    ['Анна (34 года)', '[REDACTED] ([REDACTED])'],
    ['Опыт: 10 лет', 'Опыт: 10 лет'],
    ['стаж 12 лет', 'стаж 12 лет'],
    ['опыт работы 10 лет', 'опыт работы 10 лет'],
    ['3 года опыта', '3 года опыта'],
    ['за последние 3 года', 'за последние 3 года'],
    ['более 10 лет', 'более 10 лет'],
    ['через 5 лет', 'через 5 лет'],
    ['договор на 3 года', 'договор на 3 года'],
    ['проект длился 2 года', 'проект длился 2 года'],
    ['задача выполнена за 3 года', 'задача выполнена за 3 года'],
    ['Python (3 года)', '[REDACTED] (3 года)'],
    ['Power BI (5 лет)', '[REDACTED] [REDACTED] (5 лет)'],
    ['изучал Power\tBI (5 лет)', 'изучал [REDACTED]\t[REDACTED] (5 лет)'],
    ['стаж: 5 лет; мне 34 года', 'стаж: 5 лет; мне [REDACTED]'],
    ['стаж: 5 лет\n34 года', 'стаж: 5 лет\n[REDACTED]'],
    ['работал там, мне 34 года', 'работал там, мне [REDACTED]'],
    ['работал там кандидату 34 года', 'работал там кандидату [REDACTED]'],
    ['работал в ромашке 5 лет', 'работал в [REDACTED] 5 лет'],
    ['Работал там 5 лет', '[REDACTED] там 5 лет'],
  ]) {
    it(input, () => {
      expect(createSyncSanitizer(options).sanitize(input).text).toBe(expected);
    });
  }
});

describe('issue 120 labels and complete findings', () => {
  for (const [input, expected] of [
    ['Лютик : инженер', '[REDACTED] : инженер'],
    ['Опыт: менеджер', 'Опыт: менеджер'],
    ['Стаж: 5 лет', 'Стаж: 5 лет'],
    ['Образование: не указано', 'Образование: не указано'],
    ['Навыки: sql', 'Навыки: sql'],
    ['текст Label : слово', 'текст Label : слово'],
    ['ромашка: менеджер', 'ромашка: менеджер'],
    ['работала в лютике два года', 'работала в [REDACTED] два года'],
    ['работал в компании «Ромашка Лютик»', 'работал в компании [REDACTED]'],
    ['работал в компании Ромашка.', 'работал в компании [REDACTED].'],
    ['работал в python три года', 'работал в python три года'],
    ['ivan at example dot org', '[REDACTED]'],
    ['ivan(собака)example(точка)org', '[REDACTED]'],
    ['ivan[at]example[dot]org', '[REDACTED]'],
    ['ivan.petrov (at) sub.example (dot) org', '[REDACTED]'],
    ['пишите ivan[at]example.org, спасибо', 'пишите [REDACTED], спасибо'],
    ['военный билет АБ 1234567; далее', 'военный билет [REDACTED]; далее'],
  ]) {
    it(input, () => {
      expect(createSyncSanitizer(options).sanitize(input).text).toBe(expected);
    });
  }
  it('retains JSON keys, original escapes and restoration', () => {
    const source = ' {"Ромашка":"\\u0420омашка: менеджер", "n":42} ';
    const config = { ...options, structured: 'json' };
    expect(createSyncSanitizer(config).sanitize(source).text).toBe(
      ' {"Ромашка":"[REDACTED]: менеджер", "n":42} '
    );
    for (const [input] of reported) {
      const result = createSyncSanitizer({
        ...options,
        transformation: { mode: 'placeholder' },
      }).sanitize(input);
      expect(restore(result.text, result.map)).toBe(input);
    }
  });
  it('preserves duration context through custom placeholder formats', async () => {
    for (const format of [
      '{Type}-{n}',
      '[[{TYPE}_{n}]]',
      'marker;{Type}|{n}',
    ]) {
      const config = {
        ...options,
        transformation: { mode: 'placeholder', format },
      };
      for (const input of [
        'Kubernetes (5 лет)',
        'работал в ромашке 5 лет',
        'Работал там 5 лет',
      ]) {
        const result = createSyncSanitizer(config).sanitize(input);
        expect(
          result.text.endsWith(input.includes('(') ? '(5 лет)' : '5 лет')
        ).toBe(true);
        expect(restore(result.text, result.map)).toBe(input);
        expect((await createSanitizer(config).sanitize(input)).text).toBe(
          result.text
        );
      }
    }
  });
  it('preserves duration context through generated fake values', () => {
    const config = {
      ...options,
      transformation: { mode: 'fake', key: 'issue-120-private-fixture-key' },
    };
    for (const input of ['Kubernetes (5 лет)', 'работал в ромашке 5 лет']) {
      expect(
        createSyncSanitizer(config)
          .sanitize(input)
          .text.endsWith(input.includes('(') ? '(5 лет)' : '5 лет')
      ).toBe(true);
    }
  });
  it('reports complete contact and ID spans', () => {
    for (const [input, value, type] of [
      ['пишите ivan[at]example.org', 'ivan[at]example.org', 'EMAIL'],
      ['ivan собака example.org', 'ivan собака example.org', 'EMAIL'],
      ['военный билет АБ 1234567', 'АБ 1234567', 'ID'],
    ]) {
      expect(
        inspect(input, options).some(
          (f) => f.type === type && input.slice(f.start, f.end) === value
        )
      ).toBe(true);
    }
  });
  it('keeps the new document formats independent of strict and prose modes', () => {
    for (const strict of [false, true]) {
      const config = { ...options, properNames: undefined, strict };
      for (const [input, expected] of reported.slice(0, 6)) {
        expect(createSyncSanitizer(config).sanitize(input).text).toBe(expected);
      }
      expect(
        createSyncSanitizer(config).sanitize('Ромашка: менеджер').text
      ).toBe('Ромашка: менеджер');
    }
  });
  it('exposes value-free overlap diagnostics only when requested', () => {
    const events = [];
    createSyncSanitizer({
      ...options,
      debug: (event) => events.push(event),
    }).sanitize('военный билет АБ 1234567');
    const overlap = events.find(
      (event) => event.event === 'document-prose-overlap'
    );
    expect(overlap.complete > 0).toBe(true);
    expect(Object.keys(overlap).sort()).toEqual([
      'complete',
      'event',
      'suppressed',
    ]);
  });
});
