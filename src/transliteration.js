import { firstNames } from './names.js';
// ICAO 9303 spelling and common passport/GOST variants. Transliteration is
// lossy: aliases are detection candidates, never proof of a person's identity.
const cyrillic = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
const tables = [
  'a b v g d e e zh z i i k l m n o p r s t u f kh ts ch sh shch ie y - e iu ia',
  'a b v g d e yo zh z i y k l m n o p r s t u f kh ts ch sh shch - y - e yu ya',
  'a b v g d e jo zh z i j k l m n o p r s t u f x cz ch sh shh - y - eh ju ja',
  'a b v g d e ë ž z i j k l m n o p r s t u f h c č š ŝ ʺ y ʹ è û â',
].map((t) =>
  Object.fromEntries(
    [...cyrillic].map((c, i) => [c, t.split(' ')[i].replace('-', '')])
  )
);
const inverseTables = tables.map((table) =>
  [...Object.entries(table), ['кс', 'x']]
    .filter(([, spelling]) => spelling)
    .sort((a, b) => b[1].length - a[1].length)
);
function spellings(lower) {
  const values = new Set([lower]);
  for (const table of tables) {
    const latin = [...lower].map((c) => table[c] ?? c).join('');
    values.add(latin);
    values.add(latin.replaceAll('ks', 'x'));
  }
  return values;
}
const equivalents = new Map();
for (const name of `${firstNames.ru} Олеся`.toLowerCase().split(' ')) {
  const variants = spellings(name);
  for (const variant of variants) {
    equivalents.set(variant, variants);
  }
}
export const transliteratedGivenNames = [...equivalents.keys()].filter((v) =>
  /^[a-z]+$/.test(v)
);
export function nameAliases(value) {
  const lower = value.normalize('NFC').toLowerCase();
  const values = new Set([lower]);
  if (/\p{Script=Cyrillic}/u.test(lower)) {
    for (const spelling of spellings(lower)) {
      values.add(spelling);
    }
  } else if (
    /^[\p{Script=Latin}ʺʹ]+(?:[ _-][\p{Script=Latin}ʺʹ]+)*$/u.test(lower)
  ) {
    // Greedy inverse for each passport/GOST table, with bounded ambiguity.
    for (const entries of inverseTables) {
      let inverse = '',
        index = 0;
      while (index < lower.length) {
        const entry = entries.find(
          ([c, s]) =>
            (s !== 'y' ||
              c === (/[aeiou]/.test(lower[index - 1] ?? '') ? 'й' : 'ы')) &&
            lower.startsWith(s, index)
        );
        inverse += entry?.[0] ?? lower[index];
        index += entry?.[1].length ?? 1;
      }
      for (const spelling of spellings(inverse)) {
        values.add(spelling);
      }
    }
  }
  // The same table-derived equivalences cover the whole Cyrillic gazetteer.
  for (const value of [...values]) {
    for (const variant of equivalents.get(value) ?? []) {
      values.add(variant);
    }
  }
  return [...values].filter(Boolean);
}
