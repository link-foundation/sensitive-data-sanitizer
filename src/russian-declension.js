// Finite Russian declension shared by fake names and fake entities. Case order:
// nominative, genitive, dative, accusative, instrumental, prepositional.
// `|` lists a rarer spelling, accepted when reading a form, never generated.
const fleeting = { павел: 'павл', лев: 'льв', ветер: 'ветр' };
const hush = /[жчшщц]$/u;
const a = (stem) => [
  'а',
  /[гкхжчшщ]$/u.test(stem) ? 'и' : 'ы',
  'е',
  'у',
  /[жчшщц]$/u.test(stem) ? 'ей|ею' : 'ой|ою',
  'е',
];
const adjectives = [
  [
    /[ый]й$|ой$/u,
    2,
    (w) => [w.slice(-2), 'ого', 'ому', w.slice(-2), 'ым', 'ом'],
  ],
  [/[кгхжчшщ]ий$/u, 2, () => ['ий', 'ого', 'ому', 'ий', 'им', 'ом']],
  [/ий$/u, 2, () => ['ий', 'его', 'ему', 'ий', 'им', 'ем']],
  [/ая$/u, 2, () => ['ая', 'ой', 'ой', 'ую', 'ой|ою', 'ой']],
  [/яя$/u, 2, () => ['яя', 'ей', 'ей', 'юю', 'ей|ею', 'ей']],
  [/ое$/u, 2, () => ['ое', 'ого', 'ому', 'ое', 'ым', 'ом']],
  [/ее$/u, 2, () => ['ее', 'его', 'ему', 'ее', 'им', 'ем']],
];
function noun(word, sex, animate) {
  const accusative = (genitive, nominative = '') =>
    animate ? genitive : nominative;
  if (fleeting[word]) {
    const hard = ['а', 'у', accusative('а'), 'ом', 'е'];
    return [word, ...hard.map((ending) => fleeting[word] + ending)];
  }
  const table = [
    [/ия$/u, 2, ['ия', 'ии', 'ии', 'ию', 'ией|иею', 'ии']],
    [/ье$/u, 2, ['ье', 'ья', 'ью', 'ье', 'ьем', 'ье']],
    [/ие$/u, 2, ['ие', 'ия', 'ию', 'ие', 'ием', 'ии']],
    [/ий$/u, 2, ['ий', 'ия', 'ию', accusative('ия', 'ий'), 'ием', 'ии']],
    [/й$/u, 1, ['й', 'я', 'ю', accusative('я', 'й'), 'ем', 'е']],
    [/я$/u, 1, ['я', 'и', 'е', 'ю', 'ей|ею', 'е']],
    [/а$/u, 1, a(word.slice(0, -1))],
    [/о$/u, 1, ['о', 'а', 'у', 'о', 'ом', 'е']],
  ];
  for (const [ending, remove, cases] of table) {
    if (ending.test(word)) {
      return cases.map((suffix) => attach(word.slice(0, -remove), suffix));
    }
  }
  if (word.endsWith('ь')) {
    const stem = word.slice(0, -1);
    const feminine = ['ь', 'и', 'и', 'ь', 'ью', 'и'];
    const masculine = ['ь', 'я', 'ю', accusative('я', 'ь'), 'ем', 'е'];
    const cases =
      sex === 'female'
        ? feminine
        : sex === 'male'
          ? masculine
          : masculine.map((suffix, i) =>
              suffix === feminine[i] ? suffix : `${suffix}|${feminine[i]}`
            );
    return cases.map((suffix) => attach(stem, suffix));
  }
  if (!/[бвгджзклмнпрстфхцчшщ]$/u.test(word)) {
    return Array(6).fill(word); // Indeclinable: Шевченко, Сочи.
  }
  return [
    '',
    'а',
    'у',
    accusative('а'),
    hush.test(word) ? 'ем' : 'ом',
    'е',
  ].map((suffix) => attach(word, suffix));
}
const attach = (stem, suffix) =>
  suffix
    .split('|')
    .map((ending) => stem + ending)
    .join('|');
function adjective(word) {
  for (const [ending, remove, cases] of adjectives) {
    if (ending.test(word)) {
      return cases(word).map((suffix) =>
        attach(word.slice(0, -remove), suffix)
      );
    }
  }
  return undefined;
}
function surname(word, sex) {
  if (/(?:ов|ев|ёв|ин|ын)$/u.test(word)) {
    return ['', 'а', 'у', 'а', 'ым|ом', 'е'].map((s) => attach(word, s));
  }
  if (/(?:ова|ева|ёва|ина|ына)$/u.test(word)) {
    const stem = word.slice(0, -1);
    return ['а', 'ой', 'ой', 'у', 'ой|ою', 'ой'].map((s) => attach(stem, s));
  }
  const forms = adjective(word);
  if (forms) {
    return forms;
  }
  return sex === 'female' && !/[ая]$/u.test(word)
    ? Array(6).fill(word)
    : noun(word, sex, true);
}
export const russianNoun = (word, options) =>
  options.adjective && adjective(word)
    ? adjective(word)
    : noun(word, options.sex, options.animate);
// `kind` is the name slot: lastName, firstName or middleName.
export function russianNameForms(word, kind, sex) {
  const lower = word.toLowerCase();
  if (kind === 'lastName') {
    return surname(lower, sex);
  }
  if (kind === 'middleName' && /ич$/u.test(lower)) {
    return ['', 'а', 'у', 'а', 'ем', 'е'].map((s) => attach(lower, s));
  }
  return noun(lower, sex, true);
}
const fold = (word) => word.toLowerCase().replaceAll('ё', 'е');
// Every case a surface can stand for, in case order.
export function casesOf(surface, forms) {
  const wanted = fold(surface);
  return forms.flatMap((form, index) =>
    fold(form).split('|').includes(wanted) ? [index] : []
  );
}
export const formOf = (forms, index) => forms[index].split('|')[0];
// Cases governed by a preposition, in order of preference. Bare forms like
// `Ромашке` (dative or prepositional) cannot be told apart without it.
const governed = [
  [/^(?:в|во|на|о|об|обо|при)$/u, [5, 3]],
  [/^(?:к|ко|по)$/u, [2]],
  [/^(?:с|со|над|под|перед|за)$/u, [4, 1, 3]],
  [/^(?:у|от|до|из|без|для|около|после|кроме|вокруг|против)$/u, [1]],
];
const lastWord = /(?<![\p{L}\p{M}\p{N}_-])(\p{L}{1,7})[ \t\u00a0]+([«“"]?)$/u;
export function governedCases(text, start) {
  const match = lastWord.exec(text.slice(Math.max(0, start - 12), start));
  if (!match) {
    return { cases: [] };
  }
  const word = match[1].toLowerCase();
  const rule = governed.find(([pattern]) => pattern.test(word));
  return { cases: rule?.[1] ?? [], quoted: Boolean(match[2]) };
}
// Intersects the candidates of each word; a word that fits no case is ignored.
// A quoted name in the nominative stays there: в «Вектор».
export function commonCase(candidates, context = { cases: [] }) {
  const present = candidates.filter((cases) => cases.length);
  const common = [0, 1, 2, 3, 4, 5].filter((index) =>
    present.every((cases) => cases.includes(index))
  );
  if (context.quoted && common.includes(0)) {
    return 0;
  }
  return (
    context.cases.find((index) => common.includes(index)) ?? common[0] ?? 0
  );
}
