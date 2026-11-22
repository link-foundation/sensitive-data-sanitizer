import { describe, it, expect } from 'test-anywhere';
import {
  compileKnown,
  createRestoreMap,
  createSanitizer,
  createSyncSanitizer,
  inspect,
  restore,
  sanitize,
} from '../src/index.js';

const person = (value) => ({ type: 'PERSON', value });
const spans = (text, knownPersonal) =>
  inspect(text, { knownOnly: true, knownPersonal })
    .filter((finding) => finding.type === 'PERSON')
    .map(({ start, end }) => text.slice(start, end));

describe('issue 226: known noun-type surnames', () => {
  const families = [
    ['Рабинович', 'Рабиновича', 'Рабиновичи', 'Рабиновичей'],
    ['Ковальчук', 'Ковальчуку', 'Ковальчуки', 'Ковальчуков'],
    ['Арутюнян', 'Арутюняну', 'Арутюняны', 'Арутюнянов'],
    ['Тютюнник', 'Тютюнника', 'Тютюнники', 'Тютюнников'],
    ['Мартынюк', 'Мартынюка', 'Мартынюки', 'Мартынюков'],
    ['Круг', 'Круга', 'Круги', 'Кругов'],
    ['Бок', 'Бока', 'Боки', 'Боков'],
  ];

  for (const [name, singular, nominative, genitive] of families) {
    it(`matches singular and all five plural surfaces of ${name}`, () => {
      const expected = [
        singular,
        nominative,
        genitive,
        `${name}ам`,
        `${name}ами`,
        `${name}ах`,
      ];
      const text = `${singular}. ${nominative}. У ${genitive}. К ${name}ам. С ${name}ами. О ${name}ах.`;
      expect(spans(text, compileKnown([person(name)]))).toEqual(expected);
      expect(
        spans(
          text,
          compileKnown([person(name)], {
            identifiers: true,
            transliterate: true,
          })
        )
      ).toEqual(expected);
    });
  }

  it('preserves adjective plurals and indeclinable names and separates given names', () => {
    const known = compileKnown(
      [
        'Седых',
        'Рыжих',
        'Шевченко',
        'Живаго',
        'Пётр',
        'Пряжкова',
        'Польский',
      ].map(person)
    );
    expect(
      spans(
        'Седых, Рыжих, Шевченко, Живаго, Пряжковыми, Польских, Петров, Петры, Седыхами, Рыжихов, Шевченками, Живагами.',
        known
      )
    ).toEqual([
      'Седых',
      'Рыжих',
      'Шевченко',
      'Живаго',
      'Пряжковыми',
      'Польских',
    ]);
  });

  it('matches regular soft noun-type surnames', () => {
    expect(
      spans('Шахраи, Шахраев, Шахраям, Шахраями, Шахраях.', [person('Шахрай')])
    ).toEqual(['Шахраи', 'Шахраев', 'Шахраям', 'Шахраями', 'Шахраях']);
    expect(
      spans('Врубели, Врубелей, Врубелям, Врубелями, Врубелях.', [
        person('Врубель'),
      ])
    ).toEqual(['Врубели', 'Врубелей', 'Врубелям', 'Врубелями', 'Врубелях']);
  });

  it('keeps the matching behavior of short standalone given names', () => {
    expect(
      spans('Ян, ян, Ким, ким, Яну, Киму, Кимов.', [
        person('Ян'),
        person('Ким'),
      ])
    ).toEqual(['Ян', 'ян', 'Ким', 'ким']);
  });

  it('assigns the listed surname and family forms one restorable token in JSON', () => {
    const input = JSON.stringify({
      notes: [
        'У Рабиновича',
        'К Рабиновичам',
        'С Рабиновичами',
        'О Рабиновичах',
      ],
    });
    const map = createRestoreMap();
    const result = sanitize(input, {
      knownOnly: true,
      knownPersonal: compileKnown(
        [person('Рабинович')],
        [{ ...person('Рабинович'), properCase: false }]
      ),
      structured: 'json',
      transformation: { mode: 'placeholder', map },
    });
    expect(JSON.parse(result.text).notes).toEqual([
      'У Person-1',
      'К Person-1',
      'С Person-1',
      'О Person-1',
    ]);
    expect(restore(result.text, map)).toBe(input);
  });
});

describe('issue 227: capitalization of standalone Cyrillic surnames', () => {
  const entries = ['Сундуков', 'Пряжкова', 'Рабинович'].map(person);
  const prose =
    'У Сундукова и СУНДУКОВ. Много сундуков. сундуков. Отзыв Пряжковой. Моток пряжковых ниток. пряжкова. Рабиновичей и рабиновичей.';

  it('keeps ordinary lowercase words with plain or compiled lists', () => {
    const expected = ['Сундукова', 'СУНДУКОВ', 'Пряжковой', 'Рабиновичей'];
    expect(spans(prose, entries)).toEqual(expected);
    expect(spans(prose, compileKnown(entries))).toEqual(expected);
    expect(
      spans(
        prose,
        compileKnown(entries, { identifiers: true, transliterate: true })
      )
    ).toEqual(expected);
  });

  it('still covers lowercase identifiers, Latin spellings and full names', () => {
    const input =
      'сундуков_report сундуковCase caseСундуков contact.сундуков сундуков-report sundukov пряжкова велимира';
    const known = compileKnown([...entries, person('Пряжкова Велимира')], {
      identifiers: true,
      transliterate: true,
    });
    expect(spans(input, known)).toEqual([
      'сундуков',
      'сундуков',
      'Сундуков',
      'сундуков',
      'сундуков',
      'sundukov',
      'пряжкова велимира',
    ]);
  });

  it('applies capitalization to a hyphenated standalone surname', () => {
    expect(
      spans('Римский-Корсаков и римский-корсаков', [person('Римский-Корсаков')])
    ).toEqual(['Римский-Корсаков']);
  });

  it('applies the same case gate to decoded text and identifier segments', () => {
    const upper = encodeURIComponent('Пряжкова');
    const lower = encodeURIComponent('пряжкова');
    const known = compileKnown(entries, { identifiers: true });
    expect(spans(`q=${upper}; q=${lower}; q=${lower}_notes`, known)).toEqual([
      upper,
      lower,
    ]);
  });

  it('supports opt-out per entry and as a compilation default', () => {
    const loose = { ...person('Сундуков'), properCase: false };
    const strict = { ...person('Пряжкова'), properCase: true };
    expect(spans('много сундуков', [loose])).toEqual(['сундуков']);
    expect(
      spans(
        'много сундуков и пряжковых ниток',
        compileKnown([entries[0], strict], { properCase: false })
      )
    ).toEqual(['сундуков']);
    expect(spans('сундуков', compileKnown([loose], [entries[0]]))).toEqual([
      'сундуков',
    ]);
  });

  it('preserves lowercase prose when automatic detection is also enabled', () => {
    expect(
      sanitize('Сундуков купил много сундуков.', { knownPersonal: entries })
        .text
    ).toBe('[REDACTED] купил много сундуков.');
    expect(
      sanitize('sundukov купил много сундуков.', {
        knownPersonal: compileKnown(entries, { transliterate: true }),
      }).text
    ).toBe('[REDACTED] купил много сундуков.');
  });
});

describe('issue 228: strict document prose and placeholder verification', () => {
  const options = {
    profile: 'documents',
    strict: true,
    properNames: 'capitalized',
    transformation: { mode: 'placeholder', map: false, existing: 'keep' },
  };

  it('preserves ordinary numerals, duration phrases, imperatives and English', async () => {
    const texts = [
      'Три года в продажах.',
      'Пять лет в продажах.',
      'Три года',
      'Один год. Два года. Четыре года. Шесть лет. Семь лет. Восемь лет. Девять лет. Десять лет.',
      'Двадцать три года. Девяносто один год. Сто пятьдесят пять лет.',
      'Задай следующий вопрос. Задайте следующий вопрос. Открой файл. Напишите письмо.',
      'Работал три года в продажах. Мне три года.',
      'Three years in sales.',
    ];
    const sync = createSyncSanitizer(options);
    const asyncSanitizer = createSanitizer(options);
    for (const input of texts) {
      expect(sync.inspect(input)).toEqual([]);
      expect(sync.sanitize(input).text).toBe(input);
      expect((await asyncSanitizer.sanitize(input)).text).toBe(input);
    }
  });

  it('continues to detect real names and numeric ages', () => {
    const findings = inspect('Вера Сундукова. Мне 32 года.', options);
    expect(
      findings.some(({ type }) => ['PERSON', 'PROPER_NAME'].includes(type))
    ).toBe(true);
    expect(findings.some(({ type }) => type === 'AGE')).toBe(true);
    expect(
      inspect('Проект-3 года', options).some(({ type }) => type === 'AGE')
    ).toBe(true);
  });

  it('ignores placeholder numbers and preserves a separate age on inspection', () => {
    const sync = createSyncSanitizer(options);
    expect(sync.inspect('ProperName-1 года').map(({ type }) => type)).toEqual([
      'PROPER_NAME',
    ]);
    expect(sync.sanitize('ProperName-1 года').text).toBe('ProperName-1 года');
    const input = 'ProperName-1, возраст 25 лет.';
    expect(
      sync
        .inspect(input)
        .filter(({ rule }) => rule === 'strict-age')
        .map(({ start, end }) => input.slice(start, end))
    ).toEqual(['25 лет']);
  });

  it('verifies generated default and custom placeholders without a residual age', async () => {
    for (const [suffix, format, existing, token] of [
      ['года', undefined, 'keep', 'ProperName-1'],
      ['года', undefined, 'error', 'ProperName-1'],
      ['года', '{Type}::{n}', 'error', 'ProperName::1'],
      ['лет от роду', undefined, 'keep', 'ProperName-1'],
    ]) {
      const input = `Омега ${suffix}`;
      const expected = `${token} ${suffix}`;
      const map = createRestoreMap({ format });
      const config = {
        ...options,
        transformation: { mode: 'placeholder', map, existing },
      };
      expect(createSyncSanitizer(config).sanitize(input).text).toBe(expected);
      expect((await createSanitizer(config).sanitize(input)).text).toBe(
        expected
      );
      expect(restore(expected, map)).toBe(input);
    }
  });
});
