import { createHmac } from 'node:crypto';
import { fakeName, fakeWord, wordProfile } from './fake-names.js';
import { canonicalPerson } from './placeholders.js';
import {
  isGivenName,
  isPatronymic,
  russianNameRoles,
} from './russian-names.js';
import {
  casesOf,
  commonCase,
  formOf,
  governedCases,
  russianNameForms,
  russianNoun,
} from './russian-declension.js';
import {
  organizationCore,
  samePersonal,
  wordPattern,
} from './personal-variants.js';

// Fictional but ordinary names. The lists are finite on purpose; callers can
// replace them with `transformation.pools`.
const vocabulary = {
  ORGANIZATION: {
    ru: 'Северный ветер|Альфа-Строй|Бета-Сервис|Гамма-Трейд|Меридиан|Горизонт|Гранит|Рассвет|Прогресс|Импульс|Орион|Азимут|Кристалл|Арсенал|Квант|Заря|Радуга|Волна|Орбита|Вершина|Искра|Тихая гавань|Новый горизонт|Белый парус|Золотой колос|Синяя птица',
    latin:
      'Northwind Trading|Bluebird Logistics|Silver Birch Partners|Harbor Lane Studio|Summit Ridge Supply|Clearwater Works|Redwood Systems|Maple Street Foods',
  },
  LOCATION: {
    ru: 'Зареченск|Приморск|Светлогорск|Лесногорск|Березовка|Сосновка|Каменка|Покровка|Ольховка|Заречье|Краснополье',
    latin: 'Riverton|Oakdale|Fairview|Lakewood|Brookfield|Greenville|Ashford',
  },
  EDUCATION: {
    ru: 'Северный государственный университет|Приморский технический институт|Лесногорский гуманитарный университет|Зареченский экономический колледж|Светлогорская городская школа',
    latin:
      'Riverside University|Lakeview College|Oakdale Institute of Technology|Fairview State University',
  },
};
const cyrillic = /\p{Script=Cyrillic}/u;
const surfacesKey = Symbol('fakeSurfaces');
const textKey = Symbol('fakeText');
const surfaceLimit = 1000;

// Lets each span see the other mentions of its document, as placeholders do.
export function prepareFakeText(text, findings, options) {
  const surfaces = new Map();
  for (const finding of findings) {
    if (
      ['PERSON', 'ORGANIZATION', 'LOCATION', 'EDUCATION'].includes(finding.type)
    ) {
      const values = surfaces.get(finding.type) ?? new Set();
      if (values.size < surfaceLimit) {
        values.add(text.slice(finding.start, finding.end));
      }
      surfaces.set(finding.type, values);
    }
  }
  return { ...options, [surfacesKey]: surfaces, [textKey]: text };
}
const wordCount = (value) => value.trim().split(/\s+/u).length;
// The fullest form this mention belongs to, or the mention itself.
function entityLemma(value, type, options) {
  const known = [
    ...(options.knownPersonal ?? []),
    ...(options.confirmedPersonal ?? []),
  ]
    .filter((entry) => entry.type === type)
    .map((entry) => entry.value);
  const mentions = [...(options[surfacesKey]?.get(type) ?? [])];
  for (const group of [known, mentions]) {
    const matches = group.filter((other) => samePersonal(value, other, type));
    const longest = Math.max(0, ...matches.map(wordCount));
    const fullest = [
      ...new Set(matches.filter((other) => wordCount(other) === longest)),
    ];
    // `Гранит` covers its own form `Граните`, so several forms share one lemma.
    const lemma = fullest.filter((other) =>
      fullest.every((form) => samePersonal(form, other, type))
    );
    if (lemma.length === 1) {
      return lemma[0];
    }
  }
  return type === 'PERSON' ? canonicalPerson(value, mentions) : value;
}

const applyStyle = (surface, output) =>
  surface.length > 1 && surface === surface.toUpperCase()
    ? output.toUpperCase()
    : surface === surface.toLowerCase()
      ? output.toLowerCase()
      : output;
const capitalize = (word) =>
  word[0].toUpperCase() + word.slice(1).toLowerCase();
function nameSlots(parts) {
  const roles = russianNameRoles(parts);
  if (roles) {
    return parts.map((_part, i) =>
      i === roles.surname
        ? 'lastName'
        : i === roles.patronymic
          ? 'middleName'
          : 'firstName'
    );
  }
  if (parts.length === 1) {
    return [wordProfile(parts[0]).role];
  }
  const given = parts.map((part) => isGivenName(part));
  if (parts.length === 2 && given[0] !== given[1]) {
    return given.map((isGiven) => (isGiven ? 'firstName' : 'lastName'));
  }
  return parts.map((_part, i) =>
    i === 0 ? 'firstName' : i === parts.length - 1 ? 'lastName' : 'middleName'
  );
}
function nameSex(parts, slots) {
  const at = (slot) => parts[slots.indexOf(slot)];
  const middle = at('middleName');
  if (middle && (isPatronymic(middle) || /(?:вна|чна)$/iu.test(middle))) {
    return /(?:вна|чна)$/iu.test(middle) ? 'female' : 'male';
  }
  const last = at('lastName');
  if (last && /(?:ова|ева|ёва|ина|ына|ая|яя)$/iu.test(last)) {
    return 'female';
  }
  if (last && /(?:ов|ев|ёв|ин|ын|ий|ой|ый)$/iu.test(last)) {
    return 'male';
  }
  return wordProfile(at('firstName') ?? parts[0]).sex;
}
const letters = /[\p{L}\p{M}]+/gu;
// One identity per lemma: each lemma word has one seeded fake, and the matched
// surface only decides its case, its order and its letter case.
function russianFakeName(surface, lemma, key, context) {
  const parts = lemma.trim().split(/\s+/u);
  const slots = nameSlots(parts);
  const sex = nameSex(parts, slots);
  const lemmaWords = parts.flatMap((part, i) =>
    part.match(letters).map((word) => {
      const slot = slots[i];
      return {
        slot,
        lemmaForms: russianNameForms(word, slot, sex),
        pattern: new RegExp(`^(?:${wordPattern(word, 'PERSON')})$`, 'iu'),
        first: word[0].toLowerCase().replace('ё', 'е'),
        fake: fakeWord(capitalize(word), key, slot, undefined, sex),
      };
    })
  );
  const matched = surface.match(letters).map((word) => {
    const initial = word.length === 1;
    const entry = lemmaWords.find(
      (candidate) =>
        !candidate.used &&
        (initial
          ? candidate.slot !== 'lastName' &&
            candidate.first === word.toLowerCase().replace('ё', 'е')
          : candidate.pattern.test(word))
    );
    if (entry) {
      entry.used = true;
    }
    return { word, entry, initial };
  });
  const index = commonCase(
    matched
      .filter(({ entry, initial }) => entry && !initial)
      .map(({ word, entry }) => casesOf(word, entry.lemmaForms)),
    context
  );
  let position = 0;
  return surface.replace(letters, () => {
    const { word, entry, initial } = matched[position++];
    if (!entry) {
      return fakeWord(word, key);
    }
    if (initial) {
      return entry.fake[0].toUpperCase();
    }
    const forms = russianNameForms(entry.fake, entry.slot, sex);
    return applyStyle(word, capitalize(formOf(forms, index)));
  });
}
const contextOf = (finding, options) =>
  governedCases(options[textKey] ?? '', finding.start);
export function fakePerson(value, finding, transform, options) {
  const lemma = entityLemma(value, 'PERSON', options);
  return cyrillic.test(lemma) &&
    cyrillic.test(value) &&
    !/\p{Script=Latin}/u.test(`${lemma}${value}`)
    ? russianFakeName(value, lemma, transform.key, contextOf(finding, options))
    : fakeName(value, transform.key);
}

const assigned = new WeakMap();
const lemmaKey = (core) => core.toLowerCase().replaceAll('ё', 'е');
const poolFor = (type, core, transform) =>
  transform.pools?.[type] ??
  vocabulary[type][cyrillic.test(core) ? 'ru' : 'latin'].split('|');
function isReal(candidate, type, options) {
  return [
    ...(options.knownPersonal ?? []),
    ...(options.confirmedPersonal ?? []),
    ...[...(options[surfacesKey]?.get(type) ?? [])].map((value) => ({
      type,
      value,
    })),
  ].some(
    (entry) => entry.type === type && samePersonal(candidate, entry.value, type)
  );
}
// A deterministic start, then the next free name so that two entities of one
// run never share a fake. An exhausted list continues with numbered names.
function assignFake(core, type, transform, options) {
  let state = assigned.get(transform);
  if (!state) {
    state = new Map();
    assigned.set(transform, state);
  }
  const entityKey = `${type}\0${lemmaKey(core)}`;
  if (state.has(entityKey)) {
    return state.get(entityKey);
  }
  const taken = new Set(state.values());
  const pool = poolFor(type, core, transform);
  const start = createHmac('sha256', transform.key)
    .update(`entity\0${entityKey}`)
    .digest()
    .readUInt32BE(0);
  for (let attempt = 0; ; attempt++) {
    const name = pool[(start + attempt) % pool.length];
    const round = Math.floor(attempt / pool.length);
    const candidate = round ? `${name}-${round + 1}` : name;
    if (!taken.has(candidate) && !isReal(candidate, type, options)) {
      state.set(entityKey, candidate);
      return candidate;
    }
  }
}
const nounOptions = (word, phrase, position) => ({
  animate: false,
  sex: phrase.some((other) => /[ая]я$/u.test(other)) ? 'female' : undefined,
  adjective:
    !word.includes('-') &&
    (/(?:ый|ая|яя)$/u.test(word) ||
      (/(?:ий|ой|ое|ее)$/u.test(word) && position < phrase.length - 1)),
});
// Only the last part of a hyphenated name declines: в Альфа-Строе.
const phraseForms = (phrase) => {
  const words = phrase.toLowerCase().split(/\s+/u);
  return words.map((word, position) => {
    const head = word.slice(0, word.lastIndexOf('-') + 1);
    const tail = word.slice(head.length);
    return {
      head,
      forms: russianNoun(tail, nounOptions(word, words, position)),
    };
  });
};
function phraseCase(surface, lemma, context) {
  const words = surface.split(/\s+/u);
  const lemmaForms = phraseForms(lemma);
  if (words.length !== lemmaForms.length) {
    return 0;
  }
  return commonCase(
    words.map((word, i) =>
      casesOf(word.slice(word.lastIndexOf('-') + 1), lemmaForms[i].forms)
    ),
    context
  );
}
function declinedPhrase(phrase, index) {
  if (!cyrillic.test(phrase)) {
    return phrase;
  }
  const original = phrase.split(/\s+/u);
  return phraseForms(phrase)
    .map(({ head, forms }, i) => {
      const word = head + formOf(forms, index);
      return original[i][0] === original[i][0].toUpperCase()
        ? word.replace(
            /(^|-)(\p{L})/gu,
            (_m, gap, letter) => `${gap}${letter.toUpperCase()}`
          )
        : word;
    })
    .join(' ');
}
const decoration = /^((?:(?:ООО|АО|ПАО|ИП|ЗАО)[ \t]+)?[«“"]?)(.*?)([»”"]?)$/su;
// `ООО «Ромашка»` keeps its legal form and quotes; only the name is replaced.
export function fakeEntity(value, finding, transform, options) {
  const { type } = finding;
  const [, before, core, after] = decoration.exec(value);
  const lemma = organizationCore(entityLemma(value, type, options));
  const fake = assignFake(lemma, type, transform, options);
  const output = cyrillic.test(core)
    ? declinedPhrase(fake, phraseCase(core, lemma, contextOf(finding, options)))
    : fake;
  return `${before}${applyStyle(core, output)}${after}`;
}
