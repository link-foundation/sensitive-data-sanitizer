import { describe, it, expect } from 'test-anywhere';
import { createSyncSanitizer, createSanitizer, inspect } from '../src/index.js';
import {
  attributes,
  operational,
  statuses,
} from '../experiments/issue-126/cases.mjs';

const options = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  secretlint: false,
};
for (const structured of [undefined, 'json', 'jsonl']) {
  const config = { ...options, structured };
  const wrap = (note) => (structured ? JSON.stringify({ note }) : note);
  describe(`issue 126 strict attributes (${structured ?? 'text'})`, () => {
    for (const [input, sensitive] of attributes) {
      it(input, async () => {
        // Check the complete attribute span, even when another rule detects
        // something else (e.g. the capitalized C in гепатит C).
        const start = input.indexOf(sensitive);
        expect(
          inspect(input, options).some(
            (f) =>
              f.rule === 'strict-attribute' &&
              f.start <= start &&
              f.end >= start + sensitive.length
          )
        ).toBe(true);
        const source = wrap(input);
        const result = createSyncSanitizer(config).sanitize(source).text;
        expect(result.includes(sensitive)).toBe(false);
        expect((await createSanitizer(config).sanitize(source)).text).toBe(
          result
        );
        expect(createSyncSanitizer(config).sanitize(result).text).toBe(result);
      });
    }
    for (const input of operational) {
      it(`preserves ${input}`, async () => {
        const source = wrap(input);
        expect(createSyncSanitizer(config).sanitize(source).text).toBe(source);
        expect((await createSanitizer(config).sanitize(source)).text).toBe(
          source
        );
      });
    }
  });
}
for (const structured of ['json', 'jsonl']) {
  for (const status of statuses) {
    it(`preserves ${structured} status ${status}`, async () => {
      const config = { ...options, structured };
      const source = JSON.stringify({ status });
      expect(createSyncSanitizer(config).sanitize(source).text).toBe(source);
      expect((await createSanitizer(config).sanitize(source)).text).toBe(
        source
      );
    });
  }
}

const contextual = [
  ['he is disabled', 'he is [REDACTED]'],
  ['candidate is single', 'candidate is [REDACTED]'],
  ['she is a Russian', 'she is a [REDACTED]'],
  ['they are asian', 'they are [REDACTED]'],
  ['I am a man', 'I am a [REDACTED]'],
  ['disabled applicant', '[REDACTED] applicant'],
  ['gender: male', 'gender: [REDACTED]'],
  ['male', '[REDACTED]'],
  ['female', '[REDACTED]'],
  ['marital status: single', 'marital status: [REDACTED]'],
  ['nationality: russian', 'nationality: [REDACTED]'],
  ['по национальности эвенк', 'по национальности [REDACTED]'],
  ['исповедует синтоизм', 'исповедует [REDACTED]'],
  ['болеет акромегалией', 'болеет [REDACTED]'],
  ['на учёте у нарколога', 'на учёте у [REDACTED]'],
  ['diagnosed with sarcoidosis', 'diagnosed with [REDACTED]'],
  ['suffers from fibromyalgia', 'suffers from [REDACTED]'],
  ...[
    'татарином',
    'мусульманами',
    'православному',
    'украинцами',
    'диабетический',
    'буддистками',
    'католиками',
    'атеистами',
    'белорусами',
    'судимостью',
  ].map((value) => [value, '[REDACTED]']),
  ['армянином', '[REDACTED]'],
  ['еврейкой', '[REDACTED]'],
  ['казахами', '[REDACTED]'],
  ['христианами', '[REDACTED]'],
  ['иудеями', '[REDACTED]'],
  ['эпилепсия', '[REDACTED]'],
  ['астмой', '[REDACTED]'],
  ['онкологии', '[REDACTED]'],
  ['туберкулёзом', '[REDACTED]'],
  ['психиатром', '[REDACTED]'],
  ['депрессией', '[REDACTED]'],
  ['гепатитом', '[REDACTED]'],
];
for (const structured of [undefined, 'json', 'jsonl']) {
  const config = { ...options, structured };
  const wrap = (note) => (structured ? JSON.stringify({ note }) : note);
  describe(`issue 126 context and boundaries (${structured ?? 'text'})`, () => {
    for (const [input, expected] of contextual) {
      it(input, async () => {
        const result = createSyncSanitizer(config).sanitize(wrap(input)).text;
        expect(result).toBe(wrap(expected));
        expect((await createSanitizer(config).sanitize(wrap(input))).text).toBe(
          result
        );
        expect(createSyncSanitizer(config).sanitize(result).text).toBe(result);
      });
    }
    for (const input of [
      'candidate replied; the module is disabled',
      'he is ready\nsingle run finished',
      'she is ready. locale russian selected',
      'it is a single-flight lock',
      'disabled-feature enabled',
      'single_worker',
      'superman',
      'гейзер',
      'болеет\nretry scheduled',
    ]) {
      it(`keeps ${input}`, () =>
        expect(createSyncSanitizer(config).sanitize(wrap(input)).text).toBe(
          wrap(input)
        ));
    }
  });
}

describe('issue 126 policy compatibility', () => {
  it('keeps strict detection opt-in and honors rule/type controls', () => {
    for (const input of [
      'эпилепсией',
      'he is disabled',
      'исповедует синтоизм',
    ]) {
      for (const policy of [
        { strict: false },
        { rules: { 'strict-attribute': false } },
        { types: { PERSONAL_ATTRIBUTE: false } },
        { credentialsOnly: true },
      ]) {
        expect(
          createSyncSanitizer({ ...options, ...policy }).sanitize(input).text
        ).toBe(input);
      }
    }
  });
  it('preserves status while protecting explicitly known personal values', () => {
    expect(
      createSyncSanitizer({
        ...options,
        structured: 'json',
        knownPersonal: [{ type: 'PERSONAL_ATTRIBUTE', value: 'single' }],
      }).sanitize('{"status":"single"}').text
    ).toBe('{"status":"[REDACTED]"}');
  });
  it('reports value-free opt-in diagnostic counts', () => {
    const events = [];
    inspect('he is disabled; single run finished', {
      ...options,
      debug: (e) => events.push(e),
    });
    const event = events.find((e) => e.event === 'strict-attributes');
    expect(event).toEqual({
      event: 'strict-attributes',
      detected: 1,
      suppressed: 1,
    });
  });
  for (const field of ['gender', 'nationality', 'ethnicity', 'maritalStatus']) {
    it(`protects personal JSON label ${field}`, () => {
      const input = JSON.stringify({
        [field]: field === 'maritalStatus' ? 'single' : 'russian',
      });
      expect(
        createSyncSanitizer({ ...options, structured: 'json' }).sanitize(input)
          .text
      ).toBe(JSON.stringify({ [field]: '[REDACTED]' }));
    });
  }
});

for (const structured of ['json', 'jsonl']) {
  it(`keeps personal cues inside their own ${structured} values`, () => {
    const source =
      '{"note":"candidate replied","status":"disabled","other":"single"}';
    expect(
      createSyncSanitizer({ ...options, structured }).sanitize(source).text
    ).toBe(source);
  });
  it(`detects escaped ${structured} attribute values`, async () => {
    const source = '{"note":"болеет \\u044dпилепсией"}';
    const config = { ...options, structured };
    const expected = '{"note":"болеет [REDACTED]"}';
    expect(createSyncSanitizer(config).sanitize(source).text).toBe(expected);
    expect((await createSanitizer(config).sanitize(source)).text).toBe(
      expected
    );
  });
  it(`protects an unfamiliar diagnosis in a ${structured} label`, () => {
    const source = '{"diagnosis":"sarcoidosis"}';
    expect(
      createSyncSanitizer({ ...options, structured }).sanitize(source).text
    ).toBe('{"diagnosis":"[REDACTED]"}');
  });
}
