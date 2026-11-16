import { describe, it, expect } from 'test-anywhere';
import { compileKnown, inspect, sanitize } from '../src/index.js';
import { russianNameRoles } from '../src/russian-names.js';

// Every name below is made up.
const flagSets = [{}, { identifiers: true, transliterate: true }];
const person = (values, flags = {}) =>
  compileKnown(
    values.map((value) => ({ type: 'PERSON', value })),
    flags
  );
const spans = (text, knownPersonal) =>
  inspect(text, { knownOnly: true, knownPersonal })
    .filter((f) => f.type === 'PERSON')
    .map((f) => text.slice(f.start, f.end));
const fake = (text, knownPersonal) =>
  sanitize(text, {
    knownOnly: true,
    knownPersonal,
    transformation: { mode: 'fake', key: 'example-key-0123456789abcdef' },
  }).text;

const listed = [
  'Сурдин Ян',
  'Гусев Ким',
  'Шмелёва Ева',
  'Ковыльская Ия',
  'Пыжиков Лев',
  'Рябинцева Любовь',
];

describe('issue 205: short listed given names decline', () => {
  it('finds every line of the issue reproduction', () => {
    for (const flags of flagSets) {
      const known = person(listed, flags);
      for (const [text, expected] of [
        ['Письмо Сурдину Яну', 'Сурдину Яну'],
        ['с Сурдиным Яном', 'Сурдиным Яном'],
        ['Гусеву Киму', 'Гусеву Киму'],
        ['с Гусевым Кимом', 'Гусевым Кимом'],
        ['Шмелёвой Еве', 'Шмелёвой Еве'],
        ['Шмелёву Еву', 'Шмелёву Еву'],
        ['Ковыльской Ие', 'Ковыльской Ие'],
        ['Ковыльскую Ию', 'Ковыльскую Ию'],
        ['Пыжикову Льву', 'Пыжикову Льву'],
        ['Рябинцевой Любви', 'Рябинцевой Любви'],
        ['Ян С. ответил', 'Ян С.'],
        ['Яну С. ответили', 'Яну С.'],
        ['Еве Ш.', 'Еве Ш.'],
        ['Льву П.', 'Льву П.'],
        ['Любви Р.', 'Любви Р.'],
      ]) {
        expect([text, spans(text, known)]).toEqual([text, [expected]]);
      }
    }
  });

  it('finds every case form in both orders and with the surname initial', () => {
    for (const [value, surname, forms] of [
      ['Сурдин Ян', 'Сурдин', ['Ян', 'Яна', 'Яну', 'Яном', 'Яне']],
      ['Гусев Ким', 'Гусев', ['Ким', 'Кима', 'Киму', 'Кимом', 'Киме']],
      ['Шмелёва Ева', 'Шмелёва', ['Ева', 'Евы', 'Еве', 'Еву', 'Евой']],
      ['Ковыльская Ия', 'Ковыльская', ['Ия', 'Ии', 'Ию', 'Ией']],
      ['Пыжиков Лев', 'Пыжиков', ['Лев', 'Льва', 'Льву', 'Львом', 'Льве']],
      ['Ноев Ной', 'Ноев', ['Ной', 'Ноя', 'Ною', 'Ноем', 'Ное']],
      [
        'Рябинцева Любовь',
        'Рябинцева',
        ['Любовь', 'Любви', 'Любови', 'Любовью'],
      ],
    ]) {
      for (const flags of flagSets) {
        const known = person([value], flags);
        for (const form of forms) {
          for (const name of [
            `${surname} ${form}`,
            `${form} ${surname}`,
            `${form} ${surname[0]}.`,
          ]) {
            expect([name, spans(`${name} ответил`, known)]).toEqual([
              name,
              [name],
            ]);
          }
        }
      }
    }
  });

  it('keeps short words text when they are not the given name of a pair', () => {
    for (const flags of flagSets) {
      const known = person(['Сурдин Ян', 'Шмелёва Ева'], flags);
      for (const text of ['Яну пришло письмо', 'Еве пришёл ответ', 'Яна']) {
        expect([text, spans(text, known)]).toEqual([text, []]);
      }
    }
    const single = person(['Ян']);
    expect(spans('Яну написали', single)).toEqual([]);
    expect(spans('Ян написал', single)).toEqual(['Ян']);
  });

  it('reads short given names and ё surnames as the right roles', () => {
    for (const words of [
      ['Шмелёва', 'Ева'],
      ['Фомичёв', 'Марк'],
      ['Пыжиков', 'Лев'],
      ['Сурдин', 'Ян'],
    ]) {
      expect([words, russianNameRoles(words)]).toEqual([
        words,
        { surname: 0, given: 1 },
      ]);
    }
    expect(russianNameRoles(['Ева', 'Шмелёва'])).toEqual({
      surname: 1,
      given: 0,
    });
  });

  it('replaces a declined short given name with the same fake person', () => {
    const known = person(['Сурдин Ян']);
    const [given, surname] = fake('Ян Сурдин', known).split(' ');
    expect(given).not.toBe('Ян');
    expect(surname).not.toBe('Сурдин');
    const declined = fake('Письмо Сурдину Яну', known);
    expect(declined).not.toContain('Сурдин');
    expect(declined).not.toContain('Ян');
    expect(declined.split(' ')[1].slice(0, 4)).toBe(surname.slice(0, 4));
    expect(declined.split(' ')[2].slice(0, 3)).toBe(given.slice(0, 3));
    expect(fake('Яну С. ответили', known)).toBe(
      `${declined.split(' ')[2]} ${surname[0]}. ответили`
    );
  });
});

describe('issue 206: an initial without its period ends its token', () => {
  it('ignores a letter that starts a longer token', () => {
    for (const flags of flagSets) {
      const known = person(['Фомичёв Марк'], flags);
      for (const text of [
        'Марк Ф2 и Марк Ф-2 ушли',
        'Марк Фб ушёл',
        'Марк Ф_2',
        'Марк Ф.2',
      ]) {
        const found = spans(text, known);
        expect([text, found.filter((span) => !span.endsWith('.'))]).toEqual([
          text,
          [],
        ]);
      }
      expect(spans('Марк Ф. ответил', known)).toEqual(['Марк Ф.']);
      expect(spans('Марк Ф ответил', known)).toEqual(['Марк Ф']);
      expect(spans('Марк Ф, ответь', known)).toEqual(['Марк Ф']);
      expect(spans('Спросите Марка Ф', known)).toEqual(['Марка Ф']);
    }
    const latin = person(['Фомичёв Марк'], {
      identifiers: true,
      transliterate: true,
    });
    expect(spans('if I mark F2C partial', latin)).toEqual([]);
    expect(spans('Mark F. replied', latin)).toEqual(['Mark F.']);
  });

  it('applies the same boundary to a pair whose roles are unknown', () => {
    for (const flags of flagSets) {
      const known = person(['Тютюнник Евсей'], flags);
      expect(spans('Евсей Т2 ушёл', known)).toEqual([]);
      expect(spans('Евсей Т-2 ушёл', known)).toEqual([]);
      expect(spans('Евсей Т ушёл', known)).toEqual(['Евсей Т']);
      expect(spans('Евсей Т. ушёл', known)).toEqual(['Евсей Т.']);
      expect(spans('Евсей Т.О. ушёл', known)).toEqual(['Евсей Т.О.']);
    }
  });
});
