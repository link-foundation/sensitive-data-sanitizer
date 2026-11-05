import { describe, it, expect } from 'test-anywhere';
import {
  sanitize,
  createSanitizer,
  sanitizeStream,
  restore,
  createRestoreMap,
  serializeRestoreMap,
  parseRestoreMap,
} from '../src/index.js';

const documents = (map) => ({
  profile: 'documents',
  transformation: { mode: 'placeholder', map },
});
const seeded = (seed = 'Кандидат: Петров Данил.') => {
  const map = createRestoreMap();
  sanitize(seed, documents(map));
  return map;
};
const reuse = (input, map = seeded()) => {
  const { text } = sanitize(input, documents(map));
  expect(restore(text, map)).toBe(input);
  return text;
};
// A map saved by 0.15.0: replacing bare surfaces recorded them as values.
const pollutedMap = () => ({
  ...createRestoreMap(),
  entries: [
    {
      type: 'PERSON',
      number: 1,
      token: 'Person-1',
      values: ['Петров Данил', 'петров', 'петрову', 'Данилу'],
      aliases: ['петрov данил', 'petrov danil'],
    },
  ],
});
// A part the caller listed and the document used is stored as its own value.
const ownValueMap = (value = 'Мороз') => {
  const map = createRestoreMap();
  sanitize(value, {
    knownOnly: true,
    knownPersonal: [{ type: 'PERSON', value }],
    transformation: { mode: 'placeholder', map },
  });
  return JSON.parse(JSON.stringify(map));
};

describe('issue 73: bare parts of a reused map entry', () => {
  for (const input of [
    'Опыт: петров день, данил, мария.',
    'Навыки: Битрикс петров, Excel.',
    'Навыки: Роман петров (CRM), отдел.',
    'Опыт.\nСтек: Максим петрова (ПМ), отдел.',
    'Отзыв: Алина петрову, отдел.',
    'Сильный мороз. Петров пришёл.',
    'Данил пришёл.',
  ]) {
    it(`matches a fresh map on: ${input}`, () => {
      expect(reuse(input)).toBe(reuse(input, createRestoreMap()));
      expect(reuse(input, pollutedMap())).toBe(
        reuse(input, createRestoreMap())
      );
    });
  }

  for (const [input, expected] of [
    ['Петров Данил пришёл.', 'Person-1 пришёл.'],
    ['Данил Петров пришёл.', 'Person-1 пришёл.'],
    ['петров данил пришёл.', 'Person-1 пришёл.'],
    ['ПЕТРОВ ДАНИЛ пришёл.', 'Person-1 пришёл.'],
    ['Позвонили Петрову Данилу.', 'Позвонили Person-1.'],
    ['С Петровым Данилом говорили.', 'С Person-1 говорили.'],
    ['Д. Петров пришёл.', 'Person-1 пришёл.'],
    ['Петров Д. пришёл.', 'Person-1 пришёл.'],
  ]) {
    it(`still resolves the full forms in: ${input}`, () => {
      expect(reuse(input)).toBe(expected);
      expect(reuse(input, pollutedMap())).toBe(expected);
    });
  }

  it('records no bare value while reusing a map', () => {
    const map = seeded();
    reuse('Опыт: петров день, данил. Петров пришёл.', map);
    expect(map.entries[0].values).toEqual(['Петров Данил']);
  });

  it('agrees with an explicit known value', () => {
    expect(
      sanitize('Сильный мороз. Мороз пришёл. Данил Мороз пришёл.', {
        knownOnly: true,
        knownPersonal: [{ type: 'PERSON', value: 'Данил Мороз' }],
        transformation: { mode: 'placeholder' },
      }).text
    ).toBe('Сильный мороз. Мороз пришёл. Person-1 пришёл.');
    const stored = () => seeded('Кандидат: Данил Мороз.');
    expect(reuse('Сильный мороз. Мороз пришёл.', stored())).toBe(
      'Сильный мороз. Мороз пришёл.'
    );
    expect(reuse('Данил Мороз пришёл.', stored())).toBe('Person-1 пришёл.');
  });

  it('follows a fresh map when the full name is in the same document', () => {
    const input = 'Кандидат: Петров Данил. Опыт: петров день.';
    expect(reuse(input)).toBe(reuse(input, createRestoreMap()));
  });

  it('keeps a surname with the full name of the same document', () => {
    for (const map of [createRestoreMap(), seeded()]) {
      expect(
        reuse('Кандидат: Петров Данил. Позвонили Петрову. Петров ушёл.', map)
      ).toBe('Кандидат: Person-1. Позвонили Person-1. Person-1 ушёл.');
    }
  });

  it('keeps one token across values of one structured record', () => {
    const input = JSON.stringify({
      name: 'Петров Данил',
      note: 'Петров ушёл.',
      call: 'Позвонили Петрову.',
    });
    expect(JSON.parse(reuse(input))).toEqual({
      name: 'Person-1',
      note: 'Person-1 ушёл.',
      call: 'Позвонили Person-1.',
    });
  });

  it('keeps one token across the batches of one stream', async () => {
    const map = createRestoreMap();
    let output = '';
    for await (const chunk of sanitizeStream(
      ['Кандидат: Петров Данил.\n', `${' '.repeat(9000)}\n`, 'Петров ушёл.\n'],
      documents(map)
    )) {
      output += chunk;
    }
    expect(output.replace(/ {2,}/g, '')).toBe(
      'Кандидат: Person-1.\n\nPerson-1 ушёл.\n'
    );
    expect(map.entries.length).toBe(1);
  });

  it('treats a bare part the same way in asynchronous sanitization', async () => {
    const input = 'Отзыв: Алина петрову, отдел.';
    const map = seeded();
    const { text } = await createSanitizer({
      ...documents(map),
      secretlint: false,
    }).sanitize(input);
    expect(text).toBe(input);
    expect(map.entries[0].values).toEqual(['Петров Данил']);
  });

  it('covers a given name next to a surname confirmed in the document', () => {
    const map = createRestoreMap();
    expect(reuse('Петров Данил и Алина петрову.', map)).toBe(
      'Person-1 и Person-2.'
    );
  });
});

describe('issue 73: a part stored as its own value', () => {
  it('survives a saved map and still matches alone', () => {
    expect(ownValueMap().entries[0].standalone).toEqual(['Мороз']);
    expect(reuse('Мороз пришёл.', ownValueMap())).toBe('Person-1 пришёл.');
    expect(reuse('Морозу позвонили.', ownValueMap())).toBe(
      'Person-1 позвонили.'
    );
  });

  for (const format of ['json', 'lino']) {
    it(`survives ${format} serialization`, () => {
      const map = parseRestoreMap(serializeRestoreMap(ownValueMap(), format));
      expect(map.entries[0].standalone).toEqual(['Мороз']);
      expect(reuse('Мороз пришёл.', map)).toBe('Person-1 пришёл.');
    });
  }

  it('does not match ordinary lower-case text', () => {
    const input = 'Сильный мороз.';
    expect(reuse(input, ownValueMap())).toBe(input);
  });

  it('keeps the part listed next to a full name after saving', () => {
    const map = createRestoreMap();
    expect(
      sanitize('Петров Данил. Петров.', {
        knownOnly: true,
        knownPersonal: [
          { type: 'PERSON', value: 'Петров Данил' },
          { type: 'PERSON', value: 'Петров' },
        ],
        transformation: { mode: 'placeholder', map },
      }).text
    ).toBe('Person-1. Person-1.');
    const saved = JSON.parse(JSON.stringify(map));
    expect(reuse('Петров ушёл.', saved)).toBe('Person-1 ушёл.');
  });

  for (const input of [
    'Алина Мороз пришла.',
    'Алине Мороз звонили.',
    'Роман Мороз пришёл.',
    'Романа Мороз видели.',
    'Мороз Алина Игоревна пришла.',
    'Алина Игоревна Мороз пришла.',
    'Мороз Сергеевич пришёл.',
  ]) {
    it(`gives the whole mention its own token: ${input}`, () => {
      const map = ownValueMap();
      const output = reuse(input, map);
      expect(output.startsWith('Person-2')).toBe(true);
      expect(map.entries.length).toBe(2);
    });
  }

  it('leaves an unrelated capitalized neighbour alone', () => {
    expect(reuse('Отдел Мороз.', ownValueMap())).toBe('Отдел Person-1.');
  });

  it('rejects a malformed stored list', () => {
    const map = ownValueMap();
    map.entries[0].standalone = [''];
    expect(() => sanitize('Мороз.', documents(map))).toThrow();
  });
});
