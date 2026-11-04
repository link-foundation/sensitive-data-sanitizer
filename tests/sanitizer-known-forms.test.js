import { describe, it, expect } from 'test-anywhere';
import { sanitize, restore, createRestoreMap } from '../src/index.js';

const person = (value, text) => {
  const map = createRestoreMap();
  const { text: output } = sanitize(text, {
    knownOnly: true,
    knownPersonal: [value]
      .flat()
      .map((item) => ({ type: 'PERSON', value: item })),
    transformation: { mode: 'placeholder', map },
  });
  expect(restore(output, map)).toBe(text);
  return output;
};

describe('known Russian names', () => {
  for (const [value, text, expected] of [
    [
      'Петров Данил Сергеевич',
      'с Петровым Данилом Сергеевичем.',
      'с Person-1.',
    ],
    ['Данил Сергеевич', 'с Данилом Сергеевичем.', 'с Person-1.'],
    ['Сергеевич', 'с Сергеевичем.', 'с Person-1.'],
    ['Петров Данил Сергеевич', 'о Петрове Даниле Сергеевиче.', 'о Person-1.'],
    ['Смирнова Алина Игоревна', 'со Смирновой Алиной Игоревной', 'со Person-1'],
    ['Петров Данил', 'с Петровым Данилом.', 'с Person-1.'],
    [
      'Петров Данил Сергеевич',
      'Данил Сергеевич Петров пришёл; Данилу Сергеевичу Петрову.',
      'Person-1 пришёл; Person-1.',
    ],
    ['Петров Данил Сергеевич', 'с Петровым Данилом.', 'с Person-1.'],
    ['Семёнов Пётр', 'Семенов Петр', 'Person-1'],
    ['Семенов Петр', 'Семёнов Пётр', 'Person-1'],
    [
      'Петров Данил Сергеевич',
      'Петров Д. С.; Петров Д.С.; Д. С. Петров; Петрову Д. С.',
      'Person-1; Person-1; Person-1; Person-1',
    ],
    ['Петров Данил Сергеевич', 'ПЕТРОВ ДАНИЛ СЕРГЕЕВИЧ', 'Person-1'],
  ]) {
    it(`[${value}] ${text}`, () => {
      expect(person(value, text)).toBe(expected);
    });
  }

  it('merges a name listed in full and by its parts', () => {
    expect(
      person(
        ['Данил Сергеевич', 'Петров Данил Сергеевич', 'Петров'],
        'Данил Сергеевич; Петрову Данилу Сергеевичу; Петрову'
      ).split('; ')[0]
    ).toBe(
      person(
        ['Петров Данил Сергеевич', 'Данил Сергеевич', 'Петров'],
        'Данил Сергеевич'
      )
    );
  });

  it('uses one token for a name listed with its parts', () => {
    expect(
      person(
        ['Данил Сергеевич', 'Петров Данил Сергеевич', 'Петров'],
        'Данил Сергеевич; Петрову Данилу Сергеевичу; Петрову'
      )
    ).toBe('Person-1; Person-1; Person-1');
  });

  it('does not match a part unless that part is listed', () => {
    expect(person('Петров Данил Сергеевич', 'Петров подписал.')).toBe(
      'Петров подписал.'
    );
  });

  it('keeps a given name apart from a surname built on it', () => {
    expect(person('Петр', 'Петров')).toBe('Петров');
  });
});
