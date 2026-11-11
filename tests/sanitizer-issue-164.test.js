import { describe, it, expect } from 'test-anywhere';
import {
  createSanitizer,
  createSyncSanitizer,
  inspect,
  sanitize,
} from '../src/index.js';

const policy = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  transformation: {
    mode: 'placeholder',
    map: false,
    credentials: true,
    existing: 'keep',
  },
};
const engine = createSyncSanitizer(policy);

describe('issue 164: special-category acronyms', () => {
  for (const [input, expected] of [
    ['СПИД', 'PersonalAttribute-1'],
    ['у кандидата ПТСР', 'у кандидата PersonalAttribute-1'],
    ['в детстве ставили СДВГ', 'в детстве ставили PersonalAttribute-1'],
    ['состоит в ЛГБТ сообществе', 'состоит в PersonalAttribute-1 сообществе'],
    ['candidate mentioned PTSD', 'candidate mentioned PersonalAttribute-1'],
    ['диагноз: СПИД', 'диагноз: PersonalAttribute-1'],
    ['диагноз: ВИЧ', 'диагноз: PersonalAttribute-1'],
    ['лечится от СПИДа', 'лечится от PersonalAttribute-1'],
    ['у него спид', 'у него PersonalAttribute-1'],
    ['у ребенка сдвг', 'у ребенка PersonalAttribute-1'],
    ['кандидат: птср', 'кандидат: PersonalAttribute-1'],
    ['лгбт сообщество', 'PersonalAttribute-1 сообщество'],
    ['лгбт-сообщество', 'PersonalAttribute-1'],
    ['has ptsd', 'has PersonalAttribute-1'],
    ['LGBTQ+ community', 'PersonalAttribute-1 community'],
  ]) {
    it(`labels ${JSON.stringify(input)} as a personal attribute`, () => {
      expect(engine.sanitize(input).text).toBe(expected);
    });
  }

  it('keeps words that only share a prefix with an acronym', () => {
    for (const text of ['спидометр сломан', 'птср2', 'ptsdx']) {
      expect(engine.sanitize(text).text).toBe(text);
    }
  });
});

describe('issue 164: hyphenated special-category compounds', () => {
  for (const [input, expected] of [
    ['у неё вич-инфекция', 'у неё PersonalAttribute-1'],
    ['вич-инфекция', 'PersonalAttribute-1'],
    ['ВИЧ-инфекция', 'PersonalAttribute-1'],
    ['она женщина-врач', 'она PersonalAttribute-1'],
    ['у него диабет-2', 'у него PersonalAttribute-1'],
    ['у него спид-синдром', 'у него PersonalAttribute-1'],
  ]) {
    it(`replaces the whole compound ${JSON.stringify(input)}`, () => {
      expect(engine.sanitize(input).text).toBe(expected);
    });
  }

  it('reports one span for the whole compound', () => {
    const findings = inspect('у неё вич-инфекция', policy);
    expect(findings.map((f) => [f.type, f.start, f.end])).toEqual([
      ['PERSONAL_ATTRIBUTE', 6, 18],
    ]);
  });
});

describe('issue 164: one finding per personal span', () => {
  const spans = (findings) => findings.map((f) => [f.type, f.start, f.end]);

  it('merges location rules that agree on one span', async () => {
    const options = { profile: 'documents' };
    const text = 'Город: Москва, офис у метро';
    const expected = [['LOCATION', 7, 13]];
    expect(spans(inspect(text, options))).toEqual(expected);
    expect(inspect(text, options)[0].rule).toBe('location-residence');
    expect(inspect('Город: Казань', options).length).toBe(1);
    expect(spans(createSyncSanitizer(options).inspect(text))).toEqual(expected);
    expect(spans(await createSanitizer(options).inspect(text))).toEqual(
      expected
    );
    expect(spans(sanitize(text, options).findings)).toEqual(expected);
    expect(
      spans((await createSanitizer(options).sanitize(text)).findings)
    ).toEqual(expected);
  });

  it('prefers caller-supplied values over detector rules on one span', () => {
    const findings = inspect('Contact John Smith today', {
      knownPersonal: [{ type: 'PERSON', value: 'John Smith' }],
    });
    const person = findings.filter((f) => f.type === 'PERSON');
    expect(person.length).toBe(1);
    expect(person[0].rule).toBe('known-personal');
  });

  it('keeps distinct types and credential engines on the same span', () => {
    const text = '{"city":"Москва"}';
    const findings = inspect(text, {
      profile: 'documents',
      structured: 'json',
    });
    const keys = findings.map((f) => `${f.start}:${f.end}:${f.type}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
