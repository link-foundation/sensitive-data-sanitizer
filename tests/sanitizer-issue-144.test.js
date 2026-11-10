import { describe, it, expect } from 'test-anywhere';
import { createSyncSanitizer, sanitize } from '../src/index.js';
import { compiledVocabulary } from '../src/vocabulary.js';

const policy = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  transformation: { mode: 'placeholder', map: false },
};
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
describe('issue 144 follow-up', () => {
  it('types every reported special-category word in all three frames', () => {
    const engine = createSyncSanitizer(policy);
    for (const word of words) {
      for (const [text, expected] of [
        [word, 'PersonalAttribute-1'],
        [`кандидат: ${word}`, 'кандидат: PersonalAttribute-1'],
        [
          `по словам кандидата, ${word}, готов к переезду`,
          'по словам кандидата, PersonalAttribute-1, готов к переезду',
        ],
      ]) {
        expect(engine.sanitize(text).text).toBe(expected);
      }
    }
  });
  it('lets explicit vocabulary win over a generic capitalized guess', () => {
    const engine = createSyncSanitizer({
      ...policy,
      vocabulary: { personalAttributes: ['Baptist', 'вепс'] },
    });
    expect(
      engine.sanitize('по словам кандидата, Baptist, готов к переезду').text
    ).toBe('по словам кандидата, PersonalAttribute-1, готов к переезду');
    expect(
      engine.sanitize('по словам кандидата, Вепс, готов к переезду').text
    ).toBe('по словам кандидата, PersonalAttribute-1, готов к переезду');
  });
  it('reuses compilation while observing caller edits', () => {
    const vocabulary = { personalAttributes: ['вепс'] };
    const first = compiledVocabulary(vocabulary);
    expect(compiledVocabulary(vocabulary)).toBe(first);
    expect(first.cues.has('менеджер')).toBe(true);
    vocabulary.personalAttributes.push('customattribute');
    expect(compiledVocabulary(vocabulary) === first).toBe(false);
    expect(sanitize('customattribute', { strict: true, vocabulary }).text).toBe(
      '[REDACTED]'
    );
  });
  it('keeps reviewed technology words but protects people and declared private values', () => {
    const text = 'Навыки: Python, PostgreSQL, Docker, Kubernetes';
    expect(sanitize(text, policy).text).toBe(text);
    expect(sanitize(text, { ...policy, publicKnowledge: false }).text).not.toBe(
      text
    );
    expect(sanitize('Навыки: Ivan Petrov, Python', policy).text).not.toContain(
      'Ivan'
    );
    expect(
      sanitize('Навыки: Python', {
        ...policy,
        knownPersonal: [{ type: 'PROPER_NAME', value: 'Python' }],
      }).text
    ).not.toContain('Python');
  });
  it('keeps escaped and custom namespace tokens and advances their counters', () => {
    for (const transformation of [
      { mode: 'placeholder', map: false, existing: 'keep' },
      {
        mode: 'placeholder',
        map: false,
        existing: 'keep',
        format: '[{TYPE}:{n}]',
      },
    ]) {
      const token = transformation.format ? '[PERSON:7]' : 'Person-7';
      const expected = transformation.format ? '[PERSON:8]' : 'Person-8';
      const text = JSON.stringify({ msg: `${token} Анна Смирнова` }).replace(
        '7',
        '\\u0037'
      );
      expect(
        sanitize(text, { structured: 'json', transformation }).text
      ).toContain(expected);
      expect(
        sanitize('{"msg":"request completed"}', {
          structured: 'json',
          transformation,
        }).text
      ).toBe('{"msg":"request completed"}');
    }
  });
});
