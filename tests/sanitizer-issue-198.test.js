import { describe, it, expect } from 'test-anywhere';
import { performance } from 'node:perf_hooks';
import {
  compileKnown,
  createRestoreMap,
  inspect,
  restore,
  sanitize,
} from '../src/index.js';
import { nameRole } from '../src/known-records.js';
import { knownView } from '../src/known-view.js';

// Every name below is made up.
const person = (...values) =>
  compileKnown(values.map((value) => ({ type: 'PERSON', value })));
const spans = (text, knownPersonal, options = {}) =>
  inspect(text, { knownOnly: true, knownPersonal, ...options })
    .filter((f) => f.type === 'PERSON')
    .map((f) => text.slice(f.start, f.end));
const placeholders = (text, knownPersonal, options = {}) => {
  const map = createRestoreMap();
  const { text: output } = sanitize(text, {
    knownOnly: true,
    knownPersonal,
    transformation: { mode: 'placeholder', map },
    ...options,
  });
  expect(restore(output, map)).toBe(text);
  return output;
};
const fake = (text, knownPersonal, options = {}) =>
  sanitize(text, {
    knownOnly: true,
    knownPersonal,
    transformation: { mode: 'fake', key: 'example-key-0123456789abcdef' },
    ...options,
  }).text;
const pr = person('Пряжкина Велимира Остаповна');
const zhe = person('Же Варлаам');
const ty = person('Тютюнник Евсей');
const roe = person('Jane Roe');

describe('issue 192: punctuation between the parts of a name', () => {
  it('finds a name across separator punctuation', () => {
    for (const [text, expected] of [
      ['Пряжкина Велимира', ['Пряжкина Велимира']],
      ['Пряжкина\tВелимира', ['Пряжкина\tВелимира']],
      ['Пряжкина, Велимира', ['Пряжкина, Велимира']],
      ['Пряжкина, Велимира Остаповна', ['Пряжкина, Велимира Остаповна']],
      [
        '| Пряжкина | Велимира | Остаповна |',
        ['Пряжкина | Велимира | Остаповна'],
      ],
      ['Пряжкина;Велимира', ['Пряжкина;Велимира']],
      ['"Пряжкина", "Велимира"', ['Пряжкина", "Велимира']],
      ['«Пряжкина» Велимира', ['Пряжкина» Велимира']],
      ['“Пряжкина” „Велимира“', ['Пряжкина” „Велимира']],
      ['**Пряжкина** Велимира', ['Пряжкина** Велимира']],
      ['_Пряжкина_ `Велимира`', ['Пряжкина_ `Велимира']],
      ['__Пряжкина Велимира__', ['Пряжкина Велимира']],
      ['Пряжкина (Велимира)', ['Пряжкина (Велимира']],
      ['[Пряжкина] Велимира', ['Пряжкина] Велимира']],
      ['Пряжкина / Велимира', ['Пряжкина / Велимира']],
      ['Пряжкина \\ Велимира', ['Пряжкина \\ Велимира']],
      ['Пряжкина — Велимира', ['Пряжкина — Велимира']],
      ['Пряжкина – Велимира', ['Пряжкина – Велимира']],
      ['Пряжкина,\nВелимира', ['Пряжкина,\nВелимира']],
    ]) {
      expect(spans(text, pr)).toEqual(expected);
    }
  });
  it('keeps paragraphs, hyphenated words and apostrophes apart', () => {
    expect(spans('Пряжкина\n\nВелимира', pr)).toEqual([]);
    expect(spans('Пряжкина-Велимира', pr)).toEqual([]);
    expect(spans('Пряжкина. Велимира', pr)).toEqual([]);
    expect(spans('x_Пряжкина Велимира', pr)).toEqual([]);
    expect(spans('Пряжкина Велимира_2', pr)).toEqual([]);
    const hyphen = person('Римская-Корсакова Ия');
    expect(spans('Римская-Корсакова, Ия', hyphen)).toEqual([
      'Римская-Корсакова, Ия',
    ]);
    expect(spans("О'Нил, Шон", person("Шон О'Нил"))).toEqual(["О'Нил, Шон"]);
  });
  it('replaces each part on its own so cells and quotes stay', () => {
    for (const [text, expected, faked] of [
      ['Пряжкина, Велимира', 'Person-1, Person-1', 'Денисова, Ирина'],
      [
        '| Пряжкина | Велимира | Остаповна |',
        '| Person-1 | Person-1 | Person-1 |',
        '| Денисова | Ирина | Вениаминовна |',
      ],
      [
        '"Пряжкина", "Велимира"',
        '"Person-1", "Person-1"',
        '"Денисова", "Ирина"',
      ],
      ['**Пряжкина** Велимира', '**Person-1** Person-1', '**Денисова** Ирина'],
      ['Пряжкина\tВелимира', 'Person-1\tPerson-1', 'Денисова\tИрина'],
      ['Пряжкина Велимира', 'Person-1', 'Денисова Ирина'],
      ['Пряжкина,\nВелимира', 'Person-1', 'Денисова,\nИрина'],
    ]) {
      expect(placeholders(text, pr)).toBe(expected);
      expect(fake(text, pr)).toBe(faked);
    }
  });
  it('keeps one value and a commented line break whole', () => {
    expect(placeholders('// Тютюнник\n// Евсей', ty)).toBe('// Person-1');
    expect(
      sanitize('see Тютюнник_Евсей_CV.pdf', {
        knownOnly: true,
        knownPersonal: person('Тютюнник_Евсей_CV.pdf'),
      }).text
    ).toBe('see [REDACTED]');
  });
});

describe('issue 193: a name split over the fields of one record', () => {
  const json =
    '{"first_name": "Велимира", "last_name": "Пряжкина", "middle_name": "Остаповна"}';
  it('finds every field in text and structured input', () => {
    const parts = ['Велимира', 'Пряжкина', 'Остаповна'];
    expect(spans(json, pr)).toEqual(parts);
    expect(spans(json, pr, { structured: 'json' })).toEqual(parts);
    expect(spans(`${json}\n`, pr, { structured: 'jsonl' })).toEqual(parts);
    expect(
      spans(
        'last_name: Пряжкина\nfirst_name: Велимира\nmiddle_name: Остаповна',
        pr
      )
    ).toEqual(['Пряжкина', 'Велимира', 'Остаповна']);
  });
  it('reads common record formats', () => {
    for (const [text, expected] of [
      ['last_name,first_name\nПряжкина,Велимира', ['Пряжкина,Велимира']],
      ['surname\tgiven_name\nПряжкина\tВелимира', ['Пряжкина\tВелимира']],
      [
        '| Фамилия | Имя | Отчество |\n|---|---|---|\n| Пряжкина | Велимира | Остаповна |',
        ['Пряжкина | Велимира'],
      ],
      [
        '<person><last_name>Пряжкина</last_name><first_name>Велимира</first_name></person>',
        ['Пряжкина', 'Велимира'],
      ],
      [
        "INSERT INTO people (id, first_name, last_name) VALUES (1, 'Jane', 'Roe');",
        ["Jane', 'Roe"],
      ],
      ['/users?firstName=Jane&lastName=Roe', ['Jane', 'Roe']],
      ['FIRST_NAME=Jane\nLAST_NAME=Roe', ['Jane', 'Roe']],
      ['first name = Jane\nlast name = Roe', ['Jane', 'Roe']],
      ['{"name": {"first": "Jane", "last": "Roe"}, "id": 1}', ['Jane', 'Roe']],
      ['$user->firstName = "Jane"; $user->lastName = "Roe";', ['Jane', 'Roe']],
    ]) {
      expect(spans(text, person('Пряжкина Велимира', 'Jane Roe'))).toEqual(
        expected
      );
    }
    expect(
      spans('{"name": {"first": "Jane", "last": "Roe"}, "id": 1}', roe, {
        structured: 'json',
      })
    ).toEqual(['Jane', 'Roe']);
  });
  it('does not join separate records or a single part', () => {
    for (const [text, options] of [
      ['[{"first_name": "Jane"}, {"last_name": "Roe"}]', {}],
      [
        '[{"first_name": "Jane"}, {"last_name": "Roe"}]',
        { structured: 'json' },
      ],
      ['- first_name: Jane\n  age: 3\n- last_name: Roe', {}],
      ['first_name: Jane\n\nlast_name: Roe', {}],
      ['first_name: Jane\nlast_name: Smith', {}],
      [
        '<p><last_name>Roe</last_name></p><p><first_name>Jane</first_name></p>',
        {},
      ],
      ['{"first_name": "Jane", "pet_name": "Roe"}', {}],
    ]) {
      expect(spans(text, roe, options)).toEqual([]);
    }
  });
  it('gives every field one person in placeholder and fake modes', () => {
    for (const options of [{}, { structured: 'json' }]) {
      expect(placeholders(json, pr, options)).toBe(
        '{"first_name": "Person-1", "last_name": "Person-1", "middle_name": "Person-1"}'
      );
      expect(fake(json, pr, options)).toBe(
        '{"first_name": "Ирина", "last_name": "Денисова", "middle_name": "Вениаминовна"}'
      );
    }
  });
  it('reads the role of a field key', () => {
    for (const [key, role] of [
      ['first_name', 'given'],
      ['givenName', 'given'],
      ['FNAME', 'given'],
      ['имя', 'given'],
      ['customer_first_name', 'given'],
      ['last_name', 'surname'],
      ['familyName', 'surname'],
      ['Фамилия', 'surname'],
      ['middle_name', 'patronymic'],
      ['Отчество', 'patronymic'],
      ['name', undefined],
      ['username', undefined],
      ['pet_name', undefined],
    ]) {
      expect(nameRole(key)).toBe(role);
    }
  });
});

describe('issue 194: an initial needs an upper-case letter', () => {
  it('matches upper-case initials only', () => {
    for (const [text, known, expected] of [
      ['Же В. ответил', zhe, ['Же В.']],
      ['Варлаам Ж. ответил', zhe, ['Варлаам Ж.']],
      ['Же В ответил', zhe, ['Же В']],
      ['Он же в офисе.', zhe, []],
      ['тогда же в пятницу', zhe, []],
      ['Же в офисе', zhe, []],
      ['Варлаам ж ответил', zhe, []],
      ['Тютюнник Е. ответил', ty, ['Тютюнник Е.']],
      ['тютюнник е', ty, []],
      ['Тютюнник е', ty, []],
      ['Евсей т', ty, []],
    ]) {
      expect(spans(text, known)).toEqual(expected);
    }
  });
  it('still matches inflected and lower-case surnames', () => {
    expect(spans('резюме Кукшина в архиве', person('Кукшин'))).toEqual([
      'Кукшина',
    ]);
    expect(spans('пишет тютюнник евсей', ty)).toEqual(['тютюнник евсей']);
  });
});

describe('issue 195: initials before or after the surname', () => {
  it('finds every initials form', () => {
    for (const [text, known] of [
      ['Тютюнник Е.', ty],
      ['Е. Тютюнник', ty],
      ['Е.Тютюнник', ty],
      ['Е. О. Тютюнник', ty],
      ['Е.О. Тютюнник', ty],
      ['Тютюнник Е.О.', ty],
      ['В. Пряжкина', pr],
      ['В.О. Пряжкина', pr],
      ['Пряжкина В.О.', pr],
      ['Пряжкина В. О.', pr],
    ]) {
      expect(spans(`подписал ${text}`, known)).toEqual([text]);
    }
  });
  it('needs the initial of a listed given name', () => {
    expect(spans('подписал К. Тютюнник', ty)).toEqual([]);
    expect(spans('подписал Тютюнник К.', ty)).toEqual([]);
  });
});

describe('issue 196: plural surnames', () => {
  it('matches the plural forms of a listed surname', () => {
    for (const [listed, forms] of [
      [
        'Пряжкин',
        ['Пряжкин', 'Пряжкины', 'Пряжкиных', 'Пряжкиным', 'Пряжкиными'],
      ],
      ['Пряжкина', ['Пряжкины', 'Пряжкиных', 'Пряжкиным', 'Пряжкиными']],
      [
        'Ольховецкий',
        ['Ольховецкие', 'Ольховецких', 'Ольховецким', 'Ольховецкими'],
      ],
      [
        'Ольховецкая',
        ['Ольховецкие', 'Ольховецких', 'Ольховецким', 'Ольховецкими'],
      ],
    ]) {
      for (const form of forms) {
        expect(spans(`у ${form} в гостях`, person(listed))).toEqual([form]);
      }
    }
  });
});

describe('issue 197: encoded and decorated names', () => {
  const cases = [
    '\\u041f\\u0440\\u044f\\u0436\\u043a\\u0438\\u043d\\u0430 Велимира',
    'Пряж­кина Велимира',
    'Пряж​кина Велимира',
    encodeURIComponent('Пряжкина Велимира'),
    `${encodeURIComponent('Пряжкина')}+${encodeURIComponent('Велимира')}`,
    '&#1055;&#1088;&#1103;&#1078;&#1082;&#1080;&#1085;&#1072; Велимира',
    '&#x41f;&#x440;&#x44f;&#x436;&#x43a;&#x438;&#x43d;&#x430; Велимира',
    '&Pcy;&rcy;&yacy;&zhcy;&kcy;&icy;&ncy;&acy; Велимира',
    'Пряжкина&nbsp;Велимира',
    'Пряж&shy;кина Велимира',
    'Велими́ра Пря́жкина',
    'Пряжкинa Велимира',
    'Пряжкина Вeлимира',
    'Пряжкина\\nВелимира',
    'Пряжкина\\tВелимира',
    'Пряжкина\nВелимира',
  ];
  it('finds the name and covers the encoded characters', () => {
    for (const text of cases) {
      expect(spans(`q=${text};`, pr)).toEqual([text]);
    }
    const url = `/u/${encodeURIComponent('Пряжкина')}?x=1`;
    expect(spans(url, person('Пряжкина'))).toEqual([
      encodeURIComponent('Пряжкина'),
    ]);
  });
  it('replaces an encoded name with its person', () => {
    for (const text of cases) {
      expect(placeholders(text, pr)).toBe('Person-1');
    }
  });
  it('keeps encodings with decode: false but normalizes words', () => {
    for (const text of [
      encodeURIComponent('Пряжкина Велимира'),
      '&#1055;&#1088;&#1103;&#1078;&#1082;&#1080;&#1085;&#1072; Велимира',
      'Пряжкина&nbsp;Велимира',
      'Пряжкина\\nВелимира',
      'Пряжкина+Велимира',
    ]) {
      expect(spans(text, pr, { decode: false })).toEqual([]);
    }
    for (const text of [
      'Пряжкинa Велимира',
      'Велими́ра Пря́жкина',
      'Пряж­кина Велимира',
    ]) {
      expect(spans(text, pr, { decode: false })).toEqual([text]);
    }
  });
  it('leaves other text alone', () => {
    expect(knownView('plain text, no encodings')).toBe(undefined);
    expect(knownView('Отчёт по проекту release v2.3')).toBe(undefined);
    expect(knownView('c++ 1+2 a + b')).toBe(undefined);
    expect(knownView('q=Jane+Roe').text).toBe('q=Jane Roe');
    expect(spans('Paris (Пряжкина Велимира) here', pr)).toEqual([
      'Пряжкина Велимира',
    ]);
    for (const text of [
      'cafe%20menu',
      '%FF%FEbroken %D0',
      '&unknown; &#xD800; &#99999999;',
    ]) {
      expect(spans(text, pr)).toEqual([]);
    }
  });
  it('maps invalid UTF-8 escapes to themselves', () => {
    const text = 'a%D0%9F%FFb';
    const view = knownView(text);
    expect(view.text).toBe('aП%FFb');
    expect(
      Array.from(view.text, (_, i) => text.slice(view.starts[i], view.ends[i]))
    ).toEqual(['a', '%D0%9F', '%FF', '%FF', '%FF', 'b']);
  });
});

describe('issue 198: bounded cost', () => {
  it('scans a large mixed text with a bounded cost', () => {
    const text = [
      'Отчёт по проекту release v2.3 готов. ',
      `GET /search?q=${encodeURIComponent('отчёт')}&page=2\n`,
      '<p>&#1054;&#1090;&nbsp;готов</p>\n',
      'last_name: Иванов\nfirst_name: Иван\n\n',
    ]
      .join('')
      .repeat(1500);
    const started = performance.now();
    expect(spans(`${text}Пряжкина, Велимира`, pr)).toEqual([
      'Пряжкина, Велимира',
    ]);
    expect(performance.now() - started).toBeLessThan(20000);
  });
});
