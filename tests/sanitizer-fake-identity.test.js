import { describe, it, expect } from 'test-anywhere';
import { ru } from '@faker-js/faker';
import { sanitize } from '../src/index.js';
import { russianNameForms, casesOf } from '../src/russian-declension.js';

const key = 'example-key-0123456789abcdef';
const fake = (type, value, text, extra = {}) =>
  sanitize(text, {
    knownOnly: true,
    knownPersonal: [value].flat().map((item) => ({ type, value: item })),
    transformation: { mode: 'fake', key, ...extra },
  }).text;
const person = (value, text) => fake('PERSON', value, text);

describe('one fake identity per known person', () => {
  it('declines a single surname into the matched case', () => {
    expect(
      person(
        'Петров',
        'Петров пришёл. Позвонили Петрову. Нет Петрова. С Петровым.'
      )
    ).toBe('Баранов пришёл. Позвонили Баранову. Нет Баранова. С Барановым.');
  });

  it('keeps the gender and the order of the lemma', () => {
    expect(
      person(
        'Смирнова Алина',
        'Автор — Смирнова Алина. Позвонили Смирновой Алине, письмо от Смирновой Алины, встреча с Алиной Смирновой.'
      )
    ).toBe(
      'Автор — Потапова Александра. Позвонили Потаповой Александре, письмо от Потаповой Александры, встреча с Александрой Потаповой.'
    );
  });

  it('covers a full name in every case, order and initials', () => {
    expect(
      person(
        'Петров Данил Сергеевич',
        'Автор — Петров Данил Сергеевич. Позвонили Петрову Данилу Сергеевичу, письмо от Петрова Данила Сергеевича, с Данилом Сергеевичем Петровым; Петров Д. С.; Д.С. Петрову; ПЕТРОВА ДАНИЛА.'
      )
    ).toBe(
      'Автор — Баранов Виталий Филимонович. Позвонили Баранову Виталию Филимоновичу, письмо от Баранова Виталия Филимоновича, с Виталием Филимоновичем Барановым; Баранов В. Ф.; В.Ф. Баранову; БАРАНОВА ВИТАЛИЯ.'
    );
  });

  it('uses the same identity across listed parts and ё spellings', () => {
    expect(
      person(
        ['Петров Данил Сергеевич', 'Данил Сергеевич', 'Петров'],
        'Петрову. О Даниле Сергеевиче. Петрова Данила Сергеевича.'
      )
    ).toBe('Баранову. О Виталии Филимоновиче. Баранова Виталия Филимоновича.');
    const [yo, plain] = ['Семёнову Петру', 'Семенову Петру'].map((text) =>
      person('Семёнов Пётр', text)
    );
    expect(yo).toBe(plain);
  });

  it('tells apart the dative and the prepositional by the preposition', () => {
    const output = person(
      'Никита Кузьмин',
      'к Никите Кузьмину, о Никите Кузьмине, с Никитой Кузьминым'
    );
    expect(output).toBe(
      'к Наркису Корнилову, о Наркисе Корнилове, с Наркисом Корниловым'
    );
  });

  it('gives one identity to mentions found without knownPersonal', () => {
    const { text } = sanitize('Иван Петров пришёл. Позвонили Ивану Петрову.', {
      profile: 'documents',
      transformation: { mode: 'fake', key },
    });
    expect(text).toBe('Елисей Баранов пришёл. Позвонили Елисею Баранову.');
  });

  it('declines every Russian Faker name without changing its stem', () => {
    const {
      first_name: first,
      last_name: last,
      middle_name: middle,
    } = ru.person;
    for (const [kind, names, sex] of [
      ['firstName', first.male, 'male'],
      ['firstName', first.female, 'female'],
      ['lastName', last.male, 'male'],
      ['lastName', last.female, 'female'],
      ['middleName', middle.male, 'male'],
      ['middleName', middle.female, 'female'],
    ]) {
      for (const name of names) {
        const forms = russianNameForms(name, kind, sex);
        expect(forms.length).toBe(6);
        expect(casesOf(name, forms)[0]).toBe(0);
        expect(new Set(forms).size > 1).toBe(true);
        for (const form of forms) {
          expect(/^[а-яё-]+(?:\|[а-яё-]+)?$/u.test(form)).toBe(true);
        }
      }
    }
  });
});

describe('natural fake organizations and places', () => {
  it('keeps one entity across forms, legal forms and quotes', () => {
    expect(
      fake(
        'ORGANIZATION',
        'Ромашка',
        'Работал в ООО «Ромашка», затем снова в Ромашке. К Ромашке, без Ромашки.'
      )
    ).toBe(
      'Работал в ООО «Импульс», затем снова в Импульсе. К Импульсу, без Импульса.'
    );
  });

  it('declines a place into the matched case', () => {
    expect(
      fake('LOCATION', 'Кострома', 'Живу в Костроме, родом из Костромы.')
    ).toBe('Живу в Светлогорске, родом из Светлогорска.');
  });

  it('never prints generated markers or numbers in prose', () => {
    for (const [type, value] of [
      ['ORGANIZATION', 'Acme Solutions'],
      ['LOCATION', 'Springfield'],
      ['EDUCATION', 'Северный государственный университет'],
    ]) {
      const output = fake(type, value, `Text ${value} end`);
      expect(output.includes('Example')).toBe(false);
      expect(/\d/.test(output)).toBe(false);
      expect(output.includes(value)).toBe(false);
    }
  });

  it('gives different entities different fakes and skips real values', () => {
    const output = fake(
      'ORGANIZATION',
      ['Ромашка', 'Вектор', 'Импульс'],
      'Ромашка, Вектор, Импульс'
    ).split(', ');
    expect(new Set(output).size).toBe(3);
    expect(output.includes('Импульс')).toBe(false);
  });

  it('keeps document mentions of one entity together', () => {
    const { text } = sanitize(
      'Инженер, Гранит (2018 – 2020). Работал в Граните.',
      { profile: 'documents', transformation: { mode: 'fake', key } }
    );
    expect(text).toBe(
      'Инженер, Белый парус (2018 – 2020). Работал в Белом парусе.'
    );
  });

  it('accepts caller pools and continues past their end', () => {
    expect(
      fake('ORGANIZATION', 'Ромашка', 'Ромашка, в Ромашке', {
        pools: { ORGANIZATION: ['Зелёная лампа'] },
      })
    ).toBe('Зелёная лампа, в Зелёной лампе');
    expect(
      fake('ORGANIZATION', ['Ромашка', 'Вектор'], 'Ромашка, Вектор', {
        pools: { ORGANIZATION: ['Заря'] },
      })
    ).toBe('Заря, Заря-2');
  });

  it('takes the case of a conjunct from its preposition', () => {
    expect(
      fake('ORGANIZATION', ['Ромашка', 'Лютик'], 'В Лютике и Ромашке', {
        pools: { ORGANIZATION: ['Заря', 'Импульс'] },
      })
    ).toMatch(/^В (?:Заре и Импульсе|Импульсе и Заре)$/u);
  });

  it('rejects malformed pools', () => {
    for (const pools of [null, [], { ORGANIZATION: [] }, { PERSON: ['A'] }]) {
      expect(() =>
        sanitize('text', { transformation: { mode: 'fake', key, pools } })
      ).toThrow();
    }
  });
});
