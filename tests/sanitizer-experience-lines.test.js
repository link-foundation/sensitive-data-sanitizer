import { describe, it, expect } from 'test-anywhere';
import { sanitize, restore, createRestoreMap } from '../src/index.js';

const labelled = (text) =>
  sanitize(text, {
    profile: 'documents',
    transformation: {
      mode: 'placeholder',
      format: '[{TYPE}_{n}]',
      map: false,
    },
  }).text;
const roundTrip = (text) => {
  const map = createRestoreMap();
  const { text: output } = sanitize(text, {
    profile: 'documents',
    transformation: { mode: 'placeholder', map },
  });
  return restore(output, map);
};

describe('CV experience lines', () => {
  for (const [input, expected] of [
    [
      'Менеджер по продажам, Северная торговая компания (2019-05 – 2021-03)',
      'Менеджер по продажам, [ORGANIZATION_1] (2019-05 – 2021-03)',
    ],
    [
      'Ведущий инженер, Ромашка (2018-01 – 2020-12)',
      'Ведущий инженер, [ORGANIZATION_1] (2018-01 – 2020-12)',
    ],
    [
      'QA engineer, Acme Solutions (2020-02 – 2023-06)',
      'QA engineer, [ORGANIZATION_1] (2020-02 – 2023-06)',
    ],
    [
      'Аналитик, «Северный ветер» (2018-01 – 2020-12)',
      'Аналитик, [ORGANIZATION_1] (2018-01 – 2020-12)',
    ],
    [
      'Менеджер, Северная торговая компания (май 2019 — март 2021)',
      'Менеджер, [ORGANIZATION_1] (май 2019 — март 2021)',
    ],
    [
      'Менеджер по продажам — Северная торговая компания, 2019–2021',
      'Менеджер по продажам — [ORGANIZATION_1], 2019–2021',
    ],
    [
      'Менеджер (Северная торговая компания), 2019–2021',
      'Менеджер ([ORGANIZATION_1]), 2019–2021',
    ],
    [
      'Руководитель отдела, ООО Ромашка (2018-01 – 2020-12)',
      'Руководитель отдела, [ORGANIZATION_1] (2018-01 – 2020-12)',
    ],
    [
      'Инженер, Ромашка (2018 – 2020)',
      'Инженер, [ORGANIZATION_1] (2018 – 2020)',
    ],
    [
      'Инженер, Ромашка (май 2019 — по настоящее время)',
      'Инженер, [ORGANIZATION_1] (май 2019 — по настоящее время)',
    ],
    [
      'Инженер, Ромашка (Май 2019 - н.в.)',
      'Инженер, [ORGANIZATION_1] (Май 2019 - н.в.)',
    ],
    [
      '- Senior QA Engineer, Acme Solutions (2020-02-01 – 2023-06-30)',
      '- Senior QA Engineer, [ORGANIZATION_1] (2020-02-01 – 2023-06-30)',
    ],
    ['Инженер, 2ГИС (2019 – 2021)', 'Инженер, [ORGANIZATION_1] (2019 – 2021)'],
  ]) {
    it(`replaces the employer in: ${input}`, () => {
      expect(labelled(input)).toBe(expected);
      expect(roundTrip(input)).toBe(input);
    });
  }

  it('propagates an employer to its other mentions in the same document', () => {
    const input =
      'Инженер, Ромашка (2018-01 – 2020-12)\nВ Ромашке я делал всё. Ромашка выросла.';
    expect(labelled(input)).toBe(
      'Инженер, [ORGANIZATION_1] (2018-01 – 2020-12)\nВ [ORGANIZATION_1] я делал всё. [ORGANIZATION_1] выросла.'
    );
    expect(roundTrip(input)).toBe(input);
  });

  it('needs the date range: prose with a comma is unaffected', () => {
    for (const text of [
      'Живу в Твери, работаю дома.',
      'Отчёт за 2019, 2020 годы (2019 – 2020)',
      'Сравнение, см. выше (2019 – 2021)',
      'Менеджер, Ромашка написала письмо',
    ]) {
      expect(labelled(text)).toBe(text);
    }
  });

  it('stays inside the documents profile', () => {
    const text = 'Ведущий инженер, Ромашка (2018-01 – 2020-12)';
    expect(sanitize(text).text).toBe(text);
    expect(
      sanitize(text, {
        transformation: { mode: 'placeholder', map: false },
      }).text
    ).toBe(text);
  });

  it('keeps the bounded rule fast on a long hostile line', () => {
    const line = `${'слово '.repeat(2000)}, ${'Имя '.repeat(2000)}(2019`;
    const started = Date.now();
    // The rule is anchored per line, so two long lines exercise its worst case
    // while the rest of the linear pipeline stays well below this limit.
    labelled(`${line}\n`.repeat(2));
    expect(Date.now() - started < 5000).toBe(true);
  });
});
