import { describe, it, expect } from 'test-anywhere';
import { createSyncSanitizer, createSanitizer } from '../src/index.js';
import { compiledVocabulary } from '../src/vocabulary.js';
import {
  namespacePattern,
  placeholderTokens,
  escapedPlaceholderTokens,
} from '../src/placeholder-types.js';
import { publicTechnologies } from '../src/public-technologies.js';

const policy = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  transformation: { mode: 'placeholder', map: false },
};
const frames = (word) => [
  word,
  `кандидат: ${word}`,
  `по словам кандидата, ${word}, готов к переезду`,
];
const words = [
  'кабардинец',
  'кабардинка',
  'казашка',
  'мордвин',
  'мордовка',
  'удмурт',
  'удмуртка',
  'молдаванин',
  'молдаванка',
  'Uzbek',
  'Tajik',
  'Chechen',
  'Romani',
  'Gypsy',
  'Latino',
  'Latina',
  'иудаизм',
  'старовер',
  'староверка',
  'Baptist',
  'эпилептик',
  'паралич',
  'наркомания',
  'AIDS',
  'bipolar',
  'ADHD',
  'wheelchair',
  'LGBT',
  'convicted',
  'felony',
  'профсоюз',
  'trade union',
  'коммунист',
  'коммунистка',
];

describe('issue 144 document follow-up', () => {
  it('uses typed placeholders for all 34 words in every reported frame', () => {
    const sanitizer = createSyncSanitizer(policy);
    for (const word of words) {
      for (const text of frames(word)) {
        expect(sanitizer.sanitize(text).text).toBe(
          text.replace(word, 'PersonalAttribute-1')
        );
      }
    }
  });
  it('covers inflected Russian forms without matching longer words', () => {
    const sanitizer = createSyncSanitizer(policy);
    for (const word of [
      'кабардинцем',
      'казашкой',
      'мордвином',
      'мордовкой',
      'удмурткой',
      'молдаванином',
      'староверкой',
      'эпилептиком',
      'параличом',
      'наркоманией',
      'профсоюзом',
      'коммунисткой',
    ]) {
      expect(sanitizer.sanitize(word).text).toBe('PersonalAttribute-1');
    }
    for (const text of [
      'notbipolar',
      'felony_code',
      'профсоюзный',
      'Молдавия',
    ]) {
      expect(createSyncSanitizer({ strict: true }).sanitize(text).text).toBe(
        text
      );
    }
  });
  it('gives capitalized caller stems the attribute type in sync and async engines', async () => {
    const options = {
      ...policy,
      vocabulary: { personalAttributes: ['Zorvian', 'Baptist', 'старовер'] },
    };
    const sync = createSyncSanitizer(options);
    const asyncEngine = createSanitizer({ ...options, secretlint: false });
    for (const word of ['Zorvian', 'Baptist', 'старовер']) {
      for (const text of frames(word)) {
        const expected = text.replace(word, 'PersonalAttribute-1');
        expect(sync.sanitize(text).text).toBe(expected);
        expect((await asyncEngine.sanitize(text)).text).toBe(expected);
      }
    }
  });
  it('normalizes each vocabulary object once and caches folded cue membership', () => {
    let reads = 0;
    const vocabulary = {
      get roles() {
        reads++;
        return ['Дежёрный'];
      },
    };
    const first = compiledVocabulary(vocabulary);
    expect(first.cues.has('дежерный')).toBe(true);
    const before = reads;
    for (let i = 0; i < 20; i++) {
      expect(compiledVocabulary(vocabulary)).toBe(first);
    }
    expect(reads).toBe(before);
    expect(compiledVocabulary({ roles: ['other'] }) === first).toBe(false);
    expect(compiledVocabulary({}).lists.personalAttributes.length).toBe(0);
  });
  it('keeps public technologies, their controls and nearby private names', () => {
    const sync = createSyncSanitizer(policy);
    for (const { value } of publicTechnologies) {
      const text = `Навыки: ${value}`;
      expect(sync.sanitize(text).text).toBe(text);
      expect(
        createSyncSanitizer({ ...policy, publicKnowledge: false }).sanitize(
          text
        ).text
      ).not.toBe(text);
      expect(
        createSyncSanitizer({
          ...policy,
          knownPersonal: [{ type: 'PROPER_NAME', value }],
        }).sanitize(text).text
      ).not.toContain(value);
    }
    for (const text of [
      'Опыт: работал менеджером, Python, SQL',
      'Навыки: Python, PostgreSQL, Docker, Kubernetes',
      'Experience: Python, SQL, Docker',
    ]) {
      expect(sync.sanitize(text).text).toBe(text);
    }
    const output = sync.sanitize('Навыки: Python, Ivan Petrov, Docker').text;
    expect(output).toContain('Python');
    expect(output).toContain('Docker');
    expect(output).not.toContain('Ivan');
    expect(output).not.toContain('Petrov');
    expect(sync.sanitize('Навыки: Pythonista').text).not.toContain(
      'Pythonista'
    );
    expect(
      createSyncSanitizer({ ...policy, knownSecrets: ['Python'] }).sanitize(
        'Навыки: Python'
      ).text
    ).not.toContain('Python');
  });
  it('keeps placeholder-free JSON unchanged and preserves custom and escaped tokens', () => {
    const options = {
      ...policy,
      structured: 'json',
      transformation: { ...policy.transformation, existing: 'keep' },
    };
    const sync = createSyncSanitizer(options);
    for (const text of [
      '{"level":"INFO","msg":"request completed","ms":12}',
      '{"msg":"request completed"}',
    ]) {
      expect(sync.sanitize(text).text).toBe(text);
    }
    for (const format of ['{Type}-{n}', '[{TYPE}:{n}]', '{n}/{type}']) {
      const pattern = namespacePattern(format);
      expect(placeholderTokens('no tokens here', pattern).length).toBe(0);
      expect(escapedPlaceholderTokens('"plain text 12"', pattern).length).toBe(
        0
      );
    }
    const pattern = namespacePattern();
    expect(escapedPlaceholderTokens('"Person-9"', pattern).length).toBe(0);
    expect(
      escapedPlaceholderTokens('"Person-\\u0039"', pattern)[0].number
    ).toBe(9);
    expect(placeholderTokens('Person-9', pattern)[0].number).toBe(9);
    expect(sync.sanitize('{"msg":"Person-9"}').text).toBe('{"msg":"Person-9"}');
    for (const [format, token, next] of [
      ['[{TYPE}:{n}]', '[PERSON:9]', '[PERSON:10]'],
      ['{n}/{type}', '9/person', '10/person'],
    ]) {
      const custom = createSyncSanitizer({
        ...policy,
        transformation: { ...options.transformation, format },
      });
      expect(custom.sanitize(token).text).toBe(token);
      expect(custom.sanitize(`${token}; Анна Смирнова`).text).toContain(next);
    }
  });
});
