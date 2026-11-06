import { describe, it, expect } from 'test-anywhere';
import {
  sanitize,
  inspect,
  createSanitizer,
  createSyncSanitizer,
  compileKnown,
  builtInRules,
  defaultVocabulary,
  documentVocabulary,
} from '../src/index.js';

const detector = {
  detect(text) {
    return [...text.matchAll(/Ромашка|OddlyNamed/gu)].map((m) => ({
      start: m.index,
      end: m.index + m[0].length,
      type: 'ORGANIZATION',
      category: 'personal',
      rule: 'custom',
      confidence: 1,
    }));
  },
};
function code(fn) {
  try {
    fn();
  } catch (error) {
    return error.code;
  }
}
async function both(input, expected, options = {}) {
  expect(sanitize(input, options).text).toBe(expected);
  expect(
    (await createSanitizer({ ...options, secretlint: false }).sanitize(input))
      .text
  ).toBe(expected);
}

describe('issue 108 synchronous detector contracts', () => {
  it('runs sync detectors on text, projected, encoded and decoded JSON string views', async () => {
    await both('Ромашка тут', '[REDACTED] тут', { detectors: [detector] });
    await both('Oddly\u200bNamed', '[REDACTED]', { detectors: [detector] });
    await both(
      Buffer.from('prefix OddlyNamed').toString('base64'),
      '[REDACTED]',
      { detectors: [detector] }
    );
    const input =
      '{"msg":"prefix \\u0420омашка suffix","nested":["OddlyNamed"]}';
    await both(
      input,
      '{"msg":"prefix [REDACTED] suffix","nested":["[REDACTED]"]}',
      { structured: 'json', detectors: [detector] }
    );
    const found = inspect(input, { structured: 'json', detectors: [detector] });
    expect(
      found.some((f) => input.slice(f.start, f.end) === '\\u0420омашка')
    ).toBe(true);
  });
  it('rejects promises, throws, invalid results and invalid offsets', () => {
    for (const [detect, expected] of [
      [() => Promise.resolve([]), 'ERR_CONFIG'],
      [
        () => {
          throw new Error('private input');
        },
        'ERR_ENGINE',
      ],
      [() => null, 'ERR_ENGINE'],
      [
        () => [
          {
            start: 0,
            end: 100,
            type: 'PERSON',
            category: 'personal',
            rule: 'custom',
          },
        ],
        'ERR_FINDING',
      ],
    ]) {
      const actual = code(() => sanitize('x', { detectors: [{ detect }] }));
      expect(actual).toBe(expected);
    }
  });
});

describe('issue 109 stable rule, type and field controls', () => {
  it('exports immutable rule ids and rejects unknown ids and credential suppression', async () => {
    expect(Object.isFrozen(builtInRules)).toBe(true);
    expect(builtInRules.includes('organization-context')).toBe(true);
    expect(code(() => sanitize('x', { rules: { person: false } }))).toBe(
      'ERR_CONFIG'
    );
    expect(code(() => sanitize('x', { rules: { authorization: false } }))).toBe(
      'ERR_CONFIG'
    );
    expect(code(() => sanitize('x', { types: { SECRET: false } }))).toBe(
      'ERR_CONFIG'
    );
    await both('opaque-value', 'opaque-value', {
      knownSecrets: ['opaque-value'],
      rules: { 'known-secret': false },
      allowCredentialDisable: true,
    });
  });
  it('can override every problematic issue row', async () => {
    const input = 'Работала в компании Ромашка';
    await both(input, input, { rules: { 'organization-context': false } });
    await both(input, input, { types: { ORGANIZATION: false } });
    await both(input, 'Работала в компании [REDACTED]', {
      documentEntities: false,
    });
    await both('{"location":"apps/api"}', '{"location":"apps/api"}', {
      structured: 'json',
      fields: { location: 'scan' },
    });
    await both('{"location":"anna@example.org"}', '{"location":"[REDACTED]"}', {
      structured: 'json',
      fields: { location: 'scan' },
    });
  });
});

describe('issue 110 reusable caller vocabulary', () => {
  const vocabulary = {
    roles: ['маркетолог'],
    organizationCues: ['артель'],
    educationCues: ['альма-матер'],
    personalLabels: ['личный контакт'],
    personalFields: ['contactPerson'],
  };
  it('extends every list, including Russian word forms and field case styles', async () => {
    for (const [input, expected] of [
      [
        'Маркетолог, Ромашка, Лютик (2019-05-01 — 2021-03-01)',
        'Маркетолог, [REDACTED] (2019-05-01 — 2021-03-01)',
      ],
      ['Ромашка, маркетолог', '[REDACTED], маркетолог'],
      ['работаю в АРТЕЛИ Лютик', 'работаю в АРТЕЛИ [REDACTED]'],
      ['Альма-матер: Skillbox', 'Альма-матер: [REDACTED]'],
      ['личный контакт: Абвгде', 'личный контакт: [REDACTED]'],
    ]) {
      await both(input, expected, { profile: 'documents', vocabulary });
    }
    await both(
      '{"contact_person":"Абвгде"}',
      '{"contact_person":"[REDACTED]"}',
      { profile: 'documents', vocabulary, structured: 'json' }
    );
    expect(Object.isFrozen(defaultVocabulary.roles)).toBe(true);
    expect(Object.isFrozen(documentVocabulary[0])).toBe(true);
  });
  it('replaces selected lists and rejects invalid additions', async () => {
    await both('Ромашка, менеджер', 'Ромашка, менеджер', {
      profile: 'documents',
      vocabulary: { roles: { values: [], replace: true } },
    });
    await both('Компания: Лютик', 'Компания: Лютик', {
      profile: 'documents',
      vocabulary: { organizationCues: { values: [], replace: true } },
    });
    await both('{"firstName":"Абвгде"}', '{"firstName":"Абвгде"}', {
      profile: 'documents',
      structured: 'json',
      vocabulary: { personalFields: { values: [], replace: true } },
    });
    for (const value of [
      { typo: [] },
      { roles: [null] },
      { roles: [''] },
      { roles: { values: [] } },
      { roles: ['x'.repeat(129)] },
    ]) {
      expect(code(() => sanitize('x', { vocabulary: value }))).toBe(
        'ERR_CONFIG'
      );
    }
  });
});

describe('issue 111 structured field selectors', () => {
  it('normalizes by default and supports exact matching, paths and wildcard arrays', async () => {
    const input =
      '{"foo_bar":"v","FooBar":"v","a":{"b":"v"},"items":[{"name":"v"}],"keep":"ok"}';
    await both(
      input,
      '{"foo_bar":"[REDACTED]","FooBar":"[REDACTED]","a":{"b":"[REDACTED]"},"items":[{"name":"[REDACTED]"}],"keep":"ok"}',
      { structured: 'json', sensitiveFields: ['foobar', 'a.b', 'items.*.name'] }
    );
    await both(input, input, {
      structured: 'json',
      sensitiveFields: ['fooBar'],
      exactFields: true,
    });
    await both('{"x":"value"}', '{"x":"[REDACTED]"}', {
      structured: 'json',
      sensitiveFields: ['*'],
    });
  });
  it('denies unlisted strings while preserving keys, numbers, booleans and scanning allowed strings', async () => {
    for (const structured of ['json', 'jsonl']) {
      await both(
        '{"msg":"ok","note":"Romashka","n":42,"ok":true,"empty":"","items":[{"name":"keep","note":"private"}]}',
        '{"msg":"ok","note":"[REDACTED]","n":42,"ok":true,"empty":"[REDACTED]","items":[{"name":"keep","note":"[REDACTED]"}]}',
        { structured, allowedFields: ['msg', 'level', 'items.*.name'] }
      );
      await both('{"msg":"anna@example.org"}', '{"msg":"[REDACTED]"}', {
        structured,
        allowedFields: ['msg'],
      });
    }
  });
});

describe('issue 112 transformation and sync stage contracts', () => {
  it('supports global, per-type and async callbacks and JSON escaping', async () => {
    await both('Анна Смирнова', 'Z', { transformation: () => 'Z' });
    await both('{"msg":"Анна Смирнова"}', JSON.stringify({ msg: 'Z"\n' }), {
      structured: 'json',
      transformations: { PERSON: () => 'Z"\n' },
    });
    for (const structured of ['json', 'jsonl']) {
      await both(
        '{"msg":"prefix Анна Смирнова suffix"}',
        JSON.stringify({ msg: 'prefix Z"\n suffix' }),
        {
          structured,
          transformation: () => 'Z"\n',
        }
      );
      const result = await createSanitizer({
        structured,
        secretlint: false,
        transformation: async () => 'Z"\n',
      }).sanitize('{"msg":"prefix Анна Смирнова suffix"}');
      expect(result.text).toBe(JSON.stringify({ msg: 'prefix Z"\n suffix' }));
    }
    expect(
      (
        await createSanitizer({
          secretlint: false,
          transformation: async () => 'Z',
        }).sanitize('Анна Смирнова')
      ).text
    ).toBe('Z');
    expect(
      code(() => sanitize('Анна Смирнова', { transformation: async () => 'Z' }))
    ).toBe('ERR_CONFIG');
  });
  it('blocks original, encoded original, throw and newly introduced personal data', async () => {
    for (const transformation of [
      (f) => f.value,
      (f) => Buffer.from(f.value).toString('base64'),
      () => {
        throw new Error('private');
      },
      () => 'new.person@private.org',
    ]) {
      expect(
        Boolean(code(() => sanitize('Анна Смирнова', { transformation })))
      ).toBe(true);
      let failed = false;
      try {
        await createSanitizer({ secretlint: false, transformation }).sanitize(
          'Анна Смирнова'
        );
      } catch {
        failed = true;
      }
      expect(failed).toBe(true);
    }
  });
  it('exposes a sync implementation and supports replacement detection via findings', () => {
    const sync = createSyncSanitizer({ detectors: [detector] });
    expect(sync.sanitize('Ромашка тут').text).toBe('[REDACTED] тут');
    const input = 'Ромашка, Анна Смирнова, a@b.example';
    expect(
      sanitize(input, { knownOnly: true, findings: detector.detect(input) })
        .text
    ).toBe('[REDACTED], Анна Смирнова, a@b.example');
  });
});

describe('issue 114 immutable compiled known values', () => {
  it('copies, merges, reuses and matches the same forms as plain lists', async () => {
    const entries = [
      { type: 'ORGANIZATION', value: 'Ромашка' },
      { type: 'EDUCATION', value: 'МГУ' },
      { type: 'LOCATION', value: 'Тверь' },
      { type: 'URL', value: 'https://example.org/anna' },
    ];
    const known = compileKnown(entries);
    expect(Object.isFrozen(known)).toBe(true);
    expect(Object.isFrozen(known[0])).toBe(true);
    expect(compileKnown(known, known).length).toBe(entries.length);
    for (const input of [
      'работал в ромашка',
      'работал в Ромашке',
      'Ромашка: менеджер',
      'окончил мгу',
      'Живу в Твери',
      'example.org/anna/?x=1',
      'https://example.org/anna?x=1',
    ]) {
      const expected = sanitize(input, { knownPersonal: entries }).text;
      expect(expected === input).toBe(false);
      await both(input, expected, { knownPersonal: known });
    }
    expect(
      sanitize('example.org/anna/?x=1', { knownPersonal: known }).text
    ).toBe('[REDACTED]');
    entries[0].value = 'changed';
    expect(known[0].value).toBe('Ромашка');
  });
});
