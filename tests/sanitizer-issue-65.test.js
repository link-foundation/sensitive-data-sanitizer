import { describe, it, expect } from 'test-anywhere';
import { runCli } from '../bin/sensitive-data-sanitizer.js';
import { ru } from '@faker-js/faker';
import { Readable } from 'node:stream';
import {
  sanitize,
  inspect,
  restore,
  createRestoreMap,
  createSanitizer,
  sanitizeStream,
} from '../src/index.js';

const placeholder = (extra = {}) => ({
  transformation: { mode: 'placeholder' },
  ...extra,
});
const key = 'example-key-0123456789abcdef';
const mapped = (text, options = {}) => {
  const result = sanitize(text, placeholder(options));
  expect(restore(result.text, result.map)).toBe(text);
  return result;
};

describe('placeholder namespace for technical prose', () => {
  for (const token of [
    'GPT-4',
    'ISO-9001',
    'Windows-10',
    'Python 3',
    'COVID-19',
    'Web-3',
    'SQL-92',
    'S-300',
    'xPerson-1y',
    'Person-1a',
    'Password-1',
  ]) {
    it(`preserves ${token} and restores exactly`, () => {
      expect(mapped(`Jane Doe knows ${token}.`).text).toBe(
        `Person-1 knows ${token}.`
      );
    });
  }
  for (const format of [
    undefined,
    '[{TYPE}_{n}]',
    '{type}-{n}',
    'v1:{Type}-{n}',
  ]) {
    it(`rejects actual reserved tokens with format ${format}`, () => {
      const map = createRestoreMap({ format });
      const first = sanitize('Jane Doe', {
        transformation: { mode: 'placeholder', map },
      });
      expect(() =>
        sanitize(`${first.text} met Jane Doe`, {
          transformation: { mode: 'placeholder', map },
        })
      ).toThrow();
      expect(() => sanitize('Person-1 met Jane Doe', placeholder())).toThrow();
    });
  }
});

const documents = [
  ['ООО «Северная торговая компания» — менеджер', 'Organization-1 — менеджер'],
  ['АО «Гранит-2» — инженер', 'Organization-1 — инженер'],
  [
    'Работал в ООО «Ромашка» и затем в Ромашка.',
    'Работал в Organization-1 и затем в Organization-1.',
  ],
  ...['Групп', 'Group', 'Холдинг', 'Holding'].map((marker) => [
    `Ромашка ${marker}, ведущий инженер`,
    'Organization-1, ведущий инженер',
  ]),
  ['Московский государственный университет, 2015', 'Education-1, 2015'],
  ['Северный федеральный университет имени Ломоносова', 'Education-1'],
  ['Санкт-Петербургский политехнический университет', 'Education-1'],
  ['НИУ ВШЭ, магистратура', 'Education-1, магистратура'],
  ['МГУ, обучение', 'Education-1, обучение'],
  ['Город: Кострома', 'Город: Location-1'],
  ['Проживаю: Кострома', 'Проживаю: Location-1'],
  ['Кострома, готов к переезду', 'Location-1, готов к переезду'],
  ['Ярославль, Россия', 'Location-1, Россия'],
  ['Тихогорск, Россия', 'Location-1, Россия'],
  ['Меня зовут Анна, я тестировщик.', 'Меня зовут Person-1, я тестировщик.'],
  ['С уважением, Анна', 'С уважением, Person-1'],
];
describe('Russian document entities', () => {
  for (const [text, expected] of documents) {
    it(text, () => {
      expect(mapped(text, { profile: 'documents' }).text).toBe(expected);
      expect(
        inspect(text).some((f) =>
          [
            'organization-core',
            'education-russian',
            'location-residence',
            'document-introduction',
          ].includes(f.rule)
        )
      ).toBe(false);
    });
  }
});

const knownPersonal = [
  { type: 'LOCATION', value: 'Кострома' },
  { type: 'ORGANIZATION', value: 'Ромашка' },
  { type: 'PERSON', value: 'Анна Смирнова' },
  { type: 'ORGANIZATION', value: 'ООО «Северная торговая компания»' },
];
describe('known entity forms and Unicode boundaries', () => {
  it('keeps empty or short organization cores literal', () => {
    expect(
      mapped('Example prose', {
        knownOnly: true,
        knownPersonal: [{ type: 'ORGANIZATION', value: 'ООО «»' }],
      }).text
    ).toBe('Example prose');
  });
  it('links inflected and reordered whole surfaces to a reused map entry', () => {
    const map = createRestoreMap();
    const options = {
      knownPersonal,
      profile: 'documents',
      transformation: { mode: 'placeholder', map },
    };
    for (const [text, expected] of [
      ['Кострома; ООО «Ромашка»', 'Location-1; Organization-1'],
      [
        'Живу в Костроме, работал в Ромашке.',
        'Живу в Location-1, работал в Organization-1.',
      ],
      ['Отзыв от Анны Смирновой', 'Отзыв от Person-1'],
      ['Смирновой Анне', 'Person-1'],
      [
        'Северная торговая компания; в Северной торговой компании',
        'Organization-2; в Organization-2',
      ],
    ]) {
      const result = mapped(text, options);
      expect(result.text).toBe(expected);
    }
    expect(map.entries.length).toBe(4);
    const result = sanitize('Анне Смирновой, Костроме и Ромашке', {
      knownOnly: true,
      transformation: { mode: 'placeholder', map },
    });
    expect(result.text).toBe('Person-1, Location-1 и Organization-1');
    expect(restore(result.text, map)).toBe(
      'Анне Смирновой, Костроме и Ромашке'
    );
  });
  for (const [value, text, expected] of [
    ['Lee', 'Sleep well, Lee.', 'Sleep well, Person-1.'],
    ['Ann', 'Annual report by Ann.', 'Annual report by Person-1.'],
    ['Арсенова', 'Сарсенова Анна. Арсенова', 'Сарсенова Анна. Person-1'],
    ['Смирнов', 'Смирновка. Смирновым', 'Смирновка. Person-1'],
    ['Павлов', 'Сергей Павлович. Павлов', 'Сергей Павлович. Person-1'],
    [
      'Lee',
      '1Lee Lee2 _Lee Lee_ éLee Leé lee',
      '1Lee Lee2 _Lee Lee_ éLee Leé Person-1',
    ],
  ]) {
    it(`bounds ${value} in ${text}`, () => {
      expect(
        mapped(text, {
          knownOnly: true,
          knownPersonal: [{ type: 'PERSON', value }],
        }).text
      ).toBe(expected);
      const findings = inspect(text, {
        knownPersonal: [{ type: 'PERSON', value }],
      }).filter((f) => f.rule === 'known-personal');
      expect(findings.length).toBe(1);
    });
  }
});

describe('credential prose and irreversible replacements', () => {
  for (const text of [
    'The signal is weak today.',
    'The main pass is the second one.',
    'The only downstream signal is the criterion reason code `verified_value`.',
    '| 3 | numeric guard (verification.ts:365) | mechanism PROVEN, occurrence open |',
    'The token is valid.',
    'See the error code\n  `not_found`.',
    'signals: weak',
    'passage: open',
    'bypass: enabled',
    'The password is weak today.',
    'The credentials are valid.',
  ]) {
    it(`preserves ${text}`, () => expect(mapped(text).text).toBe(text));
  }
  it('redacts genuine secrets and reports lost restorability in both APIs', async () => {
    expect(sanitize('db.pass: 1234!secret').text).toBe('db.pass: [REDACTED]');
    const text = 'password is hunter2-Xy9!q';
    for (const result of [
      sanitize(text, placeholder()),
      await createSanitizer(placeholder()).sanitize(text),
    ]) {
      expect(result.text).toBe('password is [REDACTED]');
      expect(result.irreversibleRedactions).toBe(1);
    }
    const result = mapped(text, {
      transformation: { mode: 'placeholder', credentials: true },
    });
    expect(result.irreversibleRedactions).toBe(0);
    expect(
      sanitize('api_key: sk_live_abcdef1234567890').text.includes('abcdef')
    ).toBe(false);
  });
});

const names = [
  'Петров Данил Сергеевич',
  'Данил Сергеевич Петров',
  'Петров Данил',
  'Данил Петров',
  'Кузнецов Максим Антонович',
  'Максим Кузнецов',
  'Смирнова Алина',
  'Алина Смирнова',
  'Соколова Мария Ивановна',
];
describe('Russian fake name slots', () => {
  for (const name of names) {
    for (const known of [false, true]) {
      it(`${name} (known=${known})`, () => {
        const result = sanitize(`Автор: ${name}.`, {
          transformation: { mode: 'fake', key },
          ...(known
            ? { knownPersonal: [{ type: 'PERSON', value: name }] }
            : {}),
        });
        const output = result.text.slice(7, -1).split(' ');
        const input = name.split(' ');
        expect(output.length).toBe(input.length);
        input.forEach((word, i) => expect(output[i] === word).toBe(false));
        const givenIndex = input.findIndex((w) =>
          ['Данил', 'Максим', 'Алина', 'Мария'].includes(w)
        );
        const sex = /Алина|Мария/.test(name) ? 'female' : 'male';
        expect(ru.person.first_name[sex].includes(output[givenIndex])).toBe(
          true
        );
      });
    }
  }
});

describe('known-only selection', () => {
  const text =
    'Отчёт подготовил Петров Данил Сергеевич. Пример: Иванов Иван Иванович, тел. +7 900 000-00-00, ООО «Ромашка», г. Казань.';
  const options = {
    knownOnly: true,
    profile: 'documents',
    knownPersonal: [{ type: 'PERSON', value: 'Петров Данил Сергеевич' }],
  };
  it('isolates known values in sync, async, JSON and fake modes', async () => {
    const expected = text.replace('Петров Данил Сергеевич', 'Person-1');
    expect(mapped(text, options).text).toBe(expected);
    const result = await createSanitizer(placeholder(options)).sanitize(text);
    expect(result.text).toBe(expected);
    expect(restore(result.text, result.map)).toBe(text);
    const json = JSON.stringify({ text });
    expect(
      JSON.parse(mapped(json, { ...options, structured: 'json' }).text).text
    ).toBe(expected);
    const fake = sanitize(text, {
      ...options,
      transformation: { mode: 'fake', key },
    });
    expect(fake.text.slice(fake.text.indexOf('Пример:'))).toBe(
      text.slice(text.indexOf('Пример:'))
    );
    expect(fake.text.includes('Петров Данил Сергеевич')).toBe(false);
    expect(
      sanitize('secret=private-value; password=example', {
        knownOnly: true,
        knownSecrets: ['private-value'],
      }).text
    ).toBe('secret=[REDACTED]; password=example');
  });
  it('supports known-only CLI configuration with placeholder output', async () => {
    let output = '',
      errors = '';
    const code = await runCli(
      [
        'redact',
        '-',
        '--config',
        'tests/fixtures/known-only.json',
        '--known-only',
        '--placeholder',
        '--no-map',
      ],
      {
        stdin: Readable.from([text]),
        stdout: {
          write(chunk) {
            output += chunk;
            return true;
          },
        },
        stderr: {
          write(chunk) {
            errors += chunk;
            return true;
          },
        },
      }
    );
    expect(errors).toBe('');
    expect(code).toBe(0);
    expect(output).toBe(text.replace('Петров Данил Сергеевич', 'Person-1'));
  });
  it('applies known-only and confirmed organization cores across stream records', async () => {
    for (const [input, config, expected] of [
      [
        `${text}\n`,
        placeholder(options),
        `${text.replace('Петров Данил Сергеевич', 'Person-1')}\n`,
      ],
      [
        'ООО «Ромашка»\nРаботал в Ромашка.\n',
        placeholder({ profile: 'documents' }),
        'Organization-1\nРаботал в Organization-1.\n',
      ],
    ]) {
      let output = '';
      for await (const chunk of sanitizeStream(
        Readable.from(input.split(/(?<=\n)/)),
        { sanitizer: createSanitizer(config), batchBytes: 1 }
      )) {
        output += chunk;
      }
      expect(output).toBe(expected);
    }
  });
});
