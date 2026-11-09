import { describe, it, expect } from 'test-anywhere';
import { createSyncSanitizer, createSanitizer, inspect } from '../src/index.js';

const options = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  secretlint: false,
};
const chars = (n) => 'aB3_xY9k'.repeat(Math.ceil(n / 8)).slice(0, n);
const keys = [
  `AQVN${chars(36)}`,
  `t1.${chars(60)}.${chars(86)}`,
  `YCAJE${chars(20)}`,
  `YC${chars(38)}`,
];
const prose = [
  ['candidate Ivan replied', 'candidate [REDACTED] replied'],
  ['Dear John,', 'Dear [REDACTED],'],
  ['Mr. Brown called', 'Mr. [REDACTED] called'],
  ['message from Ivan: ok', 'message from [REDACTED]: ok'],
  ['recruiter Alice replied', 'recruiter [REDACTED] replied'],
  ['applicant Petrov replied', 'applicant [REDACTED] replied'],
  ['Hi Jane,', 'Hi [REDACTED],'],
  ['Ms Brown called', 'Ms [REDACTED] called'],
  ['Dr. Smith called', 'Dr. [REDACTED] called'],
  ['Request Failed: POST /api', 'Request Failed: POST /api'],
  ['Candidate Stage changed', 'Candidate Stage changed'],
];
for (const structured of [undefined, 'json', 'jsonl']) {
  describe(`issue 122 credentials and prose (${structured ?? 'text'})`, () => {
    const config = { ...options, structured };
    const wrap = (text) => (structured ? JSON.stringify({ note: text }) : text);
    for (const [input, expected] of [
      ...keys.map((key) => [key, '[REDACTED]']),
      [`key ${keys[0]}`, 'key [REDACTED]'],
      ...prose,
    ]) {
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
for (const structured of ['json', 'jsonl']) {
  describe(`issue 122 personal fields (${structured})`, () => {
    for (const [field, value] of [
      ['candidateName', 'Petrov'],
      ['candidate_name', 'Petrov'],
      ['displayName', 'Petrov'],
      ['fullName', 'Petrov'],
      ['originalFileName', 'Petrov_Ivan_CV.pdf'],
      ['age', 34],
      ['birthYear', 1991],
    ]) {
      it(field, async () => {
        const config = { ...options, structured };
        const source = JSON.stringify({ [field]: value });
        const target = JSON.stringify({ [field]: '[REDACTED]' });
        expect(createSyncSanitizer(config).sanitize(source).text).toBe(target);
        expect((await createSanitizer(config).sanitize(source)).text).toBe(
          target
        );
        expect(createSyncSanitizer(config).sanitize(target).text).toBe(target);
      });
    }
  });
}
describe('issue 122 complete credential spans', () => {
  for (const key of keys) {
    it(key.slice(0, 5), () => {
      expect(
        inspect(key, options).some(
          (f) =>
            f.category === 'credential' && f.start === 0 && f.end === key.length
        )
      ).toBe(true);
    });
  }
});

describe('issue 122 policy and format boundaries', () => {
  it('recognizes documented API-key lengths and padded IAM tokens', () => {
    for (const key of [
      ...[35, 37, 38].map((n) => `AQVN${chars(n)}`),
      `t1.${chars(12)}==.${chars(86)}==`,
    ]) {
      expect(createSyncSanitizer(options).sanitize(`(${key}),`).text).toBe(
        '([REDACTED]),'
      );
    }
  });
  it('keeps credential protection outside document and strict profiles', () => {
    for (const key of keys) {
      expect(
        createSyncSanitizer({ secretlint: false }).sanitize(key).text
      ).toBe('[REDACTED]');
    }
  });
  it('does not infer credentials from short or embedded lookalikes', () => {
    for (const input of [
      'AQVNshort',
      'YCAJEshort',
      'YCshort',
      't1.short.short',
      `x${keys[0]}`,
    ]) {
      expect(
        inspect(input, { secretlint: false }).some((f) => f.rule === 'yandex')
      ).toBe(false);
    }
  });
  it('retains numeric formatting and keys around nested and escaped personal fields', async () => {
    const source =
      ' {"people":[{"birth_year":1991,"a\\u0067e":3.4e1,"candidate-name":"Petrov"}],"n":42} ';
    const target =
      ' {"people":[{"birth_year":"[REDACTED]","a\\u0067e":"[REDACTED]","candidate-name":"[REDACTED]"}],"n":42} ';
    const config = { ...options, structured: 'json' };
    expect(createSyncSanitizer(config).sanitize(source).text).toBe(target);
    expect((await createSanitizer(config).sanitize(source)).text).toBe(target);
  });
  it('keeps whole numeric replacements from propagating into string contents', async () => {
    for (const structured of ['json', 'jsonl']) {
      const config = { ...options, structured };
      const source =
        '{"age":34,"count":34,"note":"34","birthYear":1991,"year":1991}';
      const target =
        '{"age":"[REDACTED]","count":34,"note":"34","birthYear":"[REDACTED]","year":1991}';
      expect(createSyncSanitizer(config).sanitize(source).text).toBe(target);
      expect((await createSanitizer(config).sanitize(source)).text).toBe(
        target
      );
    }
  });
  it('keeps ambiguous fields and missing numeric values', () => {
    const input =
      '{"name":"Petrov","jobName":"Build","productName":"Widget","age":null,"birthYear":null,"count":34}';
    expect(
      createSyncSanitizer({ ...options, structured: 'json' }).sanitize(input)
        .text
    ).toBe(input);
  });
  it('honors scan-only fields, disabled types and replacement field vocabulary', () => {
    for (const config of [
      { fields: { age: 'scan', birthYear: 'scan', candidateName: 'scan' } },
      { types: { AGE: false, DATE_OF_BIRTH: false, PERSON: false } },
    ]) {
      const input = '{"age":34,"birthYear":1991,"candidateName":"Petrov"}';
      expect(
        createSyncSanitizer({
          ...options,
          ...config,
          structured: 'json',
        }).sanitize(input).text
      ).toBe(input);
    }
    const input = '{"candidateName":"Petrov"}';
    expect(
      createSyncSanitizer({
        ...options,
        structured: 'json',
        vocabulary: { personalFields: { values: [], replace: true } },
      }).sanitize(input).text
    ).toBe(input);
  });
  it('permits disabling person cues and guards credential disabling', () => {
    const input = 'candidate Ivan replied';
    expect(
      createSyncSanitizer({
        ...options,
        rules: { 'document-person-cue': false },
      }).sanitize(input).text
    ).toBe(input);
    expect(
      createSyncSanitizer({
        ...options,
        vocabulary: { personalLabels: { values: [], replace: true } },
      }).sanitize(input).text
    ).toBe(input);
    let code;
    try {
      createSyncSanitizer({ rules: { yandex: false } });
    } catch (error) {
      code = error.code;
    }
    expect(code).toBe('ERR_CONFIG');
  });
  it('requires a complete cue and capitalized name in the same clause', () => {
    for (const input of [
      'candidate stage changed',
      'candidate\nStage changed',
      'Hi there,',
      'prefixcandidate Ivan replied',
      'candidate Ivanovich123 replied',
      'Request Failed: POST /api',
      'Candidate Status changed',
    ]) {
      expect(createSyncSanitizer(options).sanitize(input).text).toBe(input);
    }
  });
});
