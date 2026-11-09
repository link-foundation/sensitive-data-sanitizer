import { describe, it, expect } from 'test-anywhere';
import { createSyncSanitizer, createSanitizer } from '../src/index.js';

const options = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  secretlint: false,
};
async function check(config, source, target) {
  expect(createSyncSanitizer(config).sanitize(source).text).toBe(target);
  expect((await createSanitizer(config).sanitize(source)).text).toBe(target);
  expect(createSyncSanitizer(config).sanitize(target).text).toBe(target);
}
const unchanged = [
  'took 30 ms Retry scheduled',
  'p95 120 ms Upstream healthy',
  'see dr Drive mount',
  'dr Who',
  'mr Robot',
  'took 30 Ms Retry',
  'took 30 ms retry',
  '12ms Retry',
];
const honorifics = [
  ['Ms. Smith called', 'Ms. [REDACTED] called'],
  ['Ms Smith called', 'Ms [REDACTED] called'],
  ['Dr. Smith called', 'Dr. [REDACTED] called'],
  ['Dr Smith called', 'Dr [REDACTED] called'],
  ['Mr. Brown called', 'Mr. [REDACTED] called'],
  ['Call Ms Smith', 'Call Ms [REDACTED]'],
];
for (const structured of [undefined, 'json', 'jsonl']) {
  describe(`issue 124 lowercase units and honorifics (${structured ?? 'text'})`, () => {
    const config = { ...options, structured };
    const wrap = (text) => (structured ? JSON.stringify({ msg: text }) : text);
    for (const [input, expected] of [
      ...unchanged.map((input) => [input, input]),
      ...honorifics,
    ]) {
      it(input, () => check(config, wrap(input), wrap(expected)));
    }
  });
}
for (const structured of ['json', 'jsonl']) {
  describe(`issue 124 compound personal fields (${structured})`, () => {
    const config = { ...options, structured };
    for (const [field, value] of [
      ['recruiterDisplayName', 'Olga'],
      ['authorFullName', 'Petrov'],
      ['resumePdfOriginalFileName', 'Petrov_Ivan_CV.pdf'],
      ['author_full_name', 'Petrov'],
      ['recruiter-display-name', 'olga'],
      ['HRFirstName', 'olga'],
    ]) {
      it(field, () =>
        check(
          config,
          JSON.stringify({ [field]: value }),
          JSON.stringify({ [field]: '[REDACTED]' })
        )
      );
    }
    for (const [field, value] of [
      ['name', 'release'],
      ['fileName', 'report.pdf'],
      ['maxAge', '30'],
      ['cacheAge', 30],
      ['rename', 'done'],
      ['nickname', 'build'],
    ]) {
      it(`keeps ${field}`, () => {
        const source = JSON.stringify({ [field]: value });
        return check(config, source, source);
      });
    }
    it('extends caller vocabulary personalFields by suffix', () =>
      check(
        { ...config, vocabulary: { personalFields: ['contactPerson'] } },
        '{"recruiterContactPerson":"olga"}',
        '{"recruiterContactPerson":"[REDACTED]"}'
      ));
  });
}
