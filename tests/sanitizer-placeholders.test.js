import { describe, it, expect } from 'test-anywhere';
import {
  sanitize,
  createSanitizer,
  restore,
  createRestoreMap,
  serializeRestoreMap,
  parseRestoreMap,
  inspect,
} from '../src/index.js';

const transformation = { mode: 'placeholder' };
describe('reversible placeholders (#54)', () => {
  it('numbers each type by first appearance and restores a free-text document', () => {
    const text =
      'Jane Doe met John Smith. Jane Doe wrote jane@private.test and john@private.test.';
    const result = sanitize(text, { transformation });
    expect(result.text).toBe(
      'Person-1 met Person-2. Person-1 wrote Email-1 and Email-2.'
    );
    expect(restore(result.text, result.map)).toBe(text);
    expect(
      restore('Ask Person-1 about Email-1. Person-10 is unknown.', result.map)
    ).toBe('Ask Jane Doe about jane@private.test. Person-10 is unknown.');
  });
  for (const format of ['{Type}-{n}', '[{TYPE}_{n}]', '{{{type}_{n}}}']) {
    it(`round trips format ${format} through both serializations`, () => {
      const result = sanitize('Jane Doe', {
        transformation: { mode: 'placeholder', format },
      });
      for (const serialization of ['json', 'lino']) {
        const map = parseRestoreMap(
          serializeRestoreMap(result.map, serialization)
        );
        expect(map).toEqual(result.map);
        expect(restore(result.text, map)).toBe('Jane Doe');
      }
    });
  }
  it('reuses a serialized map across files and continues per-type counters', () => {
    const first = sanitize('Jane Doe: jane@private.test', { transformation });
    const map = parseRestoreMap(serializeRestoreMap(first.map, 'lino'));
    const second = sanitize('Jane Doe and John Smith: john@private.test', {
      transformation: { mode: 'placeholder', map },
    });
    expect(second.text).toBe('Person-1 and Person-2: Email-2');
    expect(restore(first.text, map)).toBe('Jane Doe: jane@private.test');
    expect(restore(second.text, map)).toBe(
      'Jane Doe and John Smith: john@private.test'
    );
  });
  it('keeps an engine registry across calls and verifies with the scanner union', async () => {
    const engine = createSanitizer({ transformation });
    const a = await engine.sanitize('Jane Doe');
    const b = await engine.sanitize('John Smith met Jane Doe');
    expect(b.text).toBe('Person-2 met Person-1');
    expect(restore(a.text, b.map)).toBe('Jane Doe');
  });
  for (const structured of ['json', 'jsonl']) {
    it(`restores exact ${structured} keys, values, escapes and variant surfaces`, () => {
      const records = [
        '{ "Jane Doe": "J. Doe met Doe", "other":"Jane Doe" }',
        '{"person":"Иван Иванов", "text":"Ивановым / Иванова / Ivan Ivanov"}',
      ];
      const text =
        structured === 'json'
          ? `[${records.join(',')}]`
          : `${records.join('\n')}\n`;
      const result = sanitize(text, { structured, transformation });
      if (structured === 'json') {
        JSON.parse(result.text);
      } else {
        result.text
          .trim()
          .split('\n')
          .forEach((line) => JSON.parse(line));
      }
      expect(restore(result.text, result.map)).toBe(text);
      expect(result.text.includes('Doe')).toBe(false);
      expect(result.text.includes('Иван')).toBe(false);
      expect(result.text.includes('Ivan')).toBe(false);
    });
  }
  it('links surname and initial surfaces to one token, including early mentions', () => {
    const text = 'Doe met J. Doe. Jane Doe waved.';
    const result = sanitize(text, { transformation });
    expect(result.text).toBe('Person-1 met Person-1. Person-1 waved.');
    expect(restore(result.text, result.map)).toBe(text);
  });
  it('does not merge distinct people sharing a surname', () => {
    const result = sanitize('Jane Doe and John Doe', { transformation });
    expect(result.text).toBe('Person-1 and Person-2');
  });
  it('never retains credentials without explicit opt-in', () => {
    const text = 'Jane Doe\npassword: private-canary-value';
    const result = sanitize(text, { transformation });
    expect(result.text).toBe('Person-1\npassword: [REDACTED]');
    expect(JSON.stringify(result.map).includes('private-canary-value')).toBe(
      false
    );
    const opted = sanitize(text, {
      transformation: { mode: 'placeholder', credentials: true },
    });
    expect(opted.text).toBe('Person-1\npassword: Credential-1');
    expect(restore(opted.text, opted.map)).toBe(text);
  });
  it('produces no map and still verifies residuals in no-map mode', async () => {
    const options = { transformation: { mode: 'placeholder', map: false } };
    const result = sanitize('Jane Doe met jane@private.test', options);
    expect(result.text).toBe('Person-1 met Email-1');
    expect(Object.hasOwn(result, 'map')).toBe(false);
    const asynchronous = await createSanitizer({
      ...options,
      secretlint: false,
    }).sanitize('Jane Doe');
    expect(Object.hasOwn(asynchronous, 'map')).toBe(false);
  });
  it('blocks namespace collisions, invalid templates and private map publication', () => {
    for (const text of ['Jane Doe met Person-1', 'Person-99 and Jane Doe']) {
      expect(() => sanitize(text, { transformation })).toThrow();
    }
    for (const format of [
      'fixed',
      '{Type}',
      '{n}',
      '{Type}-{n}-{n}',
      '{Type}\n{n}',
    ]) {
      expect(() =>
        sanitize('Jane Doe', {
          transformation: { mode: 'placeholder', format },
        })
      ).toThrow();
    }
    const result = sanitize('Jane Doe', { transformation });
    for (const format of ['json', 'lino']) {
      expect(() => inspect(serializeRestoreMap(result.map, format))).toThrow();
      expect(() => sanitize(serializeRestoreMap(result.map, format))).toThrow();
    }
  });
});
describe('private restore map validation', () => {
  it('rejects malformed maps and preserves arbitrary quoted originals with upstream Links Notation', () => {
    const value = 'Name "quoted" \\ path\nsecond line (a: b)';
    const result = sanitize(value, {
      knownPersonal: [{ type: 'PERSON', value }],
      transformation,
    });
    expect(
      restore(
        result.text,
        parseRestoreMap(serializeRestoreMap(result.map, 'lino'))
      )
    ).toBe(value);
    const bad = createRestoreMap();
    bad.entries.push({
      type: 'PERSON',
      number: 0,
      token: 'Person-0',
      values: ['Jane Doe'],
      aliases: [],
    });
    expect(() => parseRestoreMap(JSON.stringify(bad))).toThrow();
  });
});

it('refuses conflicting originals with indistinguishable complete sanitized documents', () => {
  const map = createRestoreMap();
  const options = { transformation: { mode: 'placeholder', map } };
  sanitize('Jane Doe', options);
  expect(() => sanitize('J. Doe', options)).toThrow();
});
it('discards a no-map engine registry after each operation', async () => {
  const engine = createSanitizer({
    secretlint: false,
    transformation: { mode: 'placeholder', map: false },
  });
  await engine.sanitize('Jane Doe');
  expect((await engine.sanitize('John Smith')).text).toBe('Person-1');
});
it('assigns phone and date placeholders by type', () => {
  const text = 'phone: +1-212-555-0198\ndate of birth: 1990-01-02';
  const result = sanitize(text, { transformation });
  expect(result.text).toBe('phone: Phone-1\ndate of birth: Date-1');
  expect(restore(result.text, result.map)).toBe(text);
});
it('links all Cyrillic inflections and transliterations to the same identity', () => {
  const text = 'Иван Иванов; Ивановым; Иванова; Ivan Ivanov';
  const result = sanitize(text, { transformation });
  expect(result.text).toBe('Person-1; Person-1; Person-1; Person-1');
  expect(restore(result.text, result.map)).toBe(text);
});
it('runs residual verification on placeholder output in no-map mode', async () => {
  const engine = createSanitizer({
    secretlint: false,
    transformation: { mode: 'placeholder', map: false },
    detectors: [
      {
        detect(text) {
          return text.includes('Person-1')
            ? [
                {
                  start: text.indexOf('tail'),
                  end: text.indexOf('tail') + 4,
                  type: 'SECRET',
                  category: 'credential',
                  rule: 'regression',
                },
              ]
            : [];
        },
      },
    ],
  });
  let rejected = false;
  try {
    await engine.sanitize('Jane Doe tail');
  } catch (error) {
    rejected = error.code === 'ERR_RESIDUAL';
  }
  expect(rejected).toBe(true);
});

it('rejects a pre-existing token hidden by JSON escapes', () => {
  expect(() =>
    sanitize('{"name":"Jane Doe","quote":"Person\\u002d1"}', {
      structured: 'json',
      transformation,
    })
  ).toThrow();
});
it('round trips encoded personal payloads without retaining nested documents', async () => {
  const text = `payload: ${Buffer.from('Jane Doe met J. Doe').toString('base64')}`;
  for (const engine of [
    undefined,
    createSanitizer({
      secretlint: false,
      transformation,
      preserveEncoding: true,
    }),
  ]) {
    const result = engine
      ? await engine.sanitize(text)
      : sanitize(text, { transformation, preserveEncoding: true });
    expect(result.text.includes('Jane')).toBe(false);
    expect(restore(result.text, result.map)).toBe(text);
    expect(result.map.documents.length).toBe(1);
  }
});
it('numbers plain and encoded names in source order in both APIs', async () => {
  const text = `John Smith then ${Buffer.from('Jane Doe met J. Doe').toString('base64')}`;
  const options = { transformation, preserveEncoding: true };
  for (const result of [
    sanitize(text, options),
    await createSanitizer({ ...options, secretlint: false }).sanitize(text),
  ]) {
    expect(result.text.startsWith('Person-1 then ')).toBe(true);
    expect(
      result.map.entries
        .filter((e) => e.type === 'PERSON')
        .map((e) => e.values[0])
    ).toEqual(['John Smith', 'Jane Doe']);
    expect(restore(result.text, result.map)).toBe(text);
  }
});
