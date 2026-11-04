import { firstNames } from './names.js';

// Finite Russian name grammar shared by known-value matching and fake mode.
const patronymic = /(?:ич|овна|евна|ична|vich|ovna|evna)$/iu;
const surname = /(?:ов|ев|ин|ын|ский|цкий|ова|ева|ина|ына|ская|цкая)$/iu;
const fold = (word) => word.toLowerCase().replaceAll('ё', 'е');
const givenNames = new Set(firstNames.ru.split(' ').map(fold));

export const isPatronymic = (word) => patronymic.test(word);
export const isGivenName = (word) => givenNames.has(fold(word));

// Returns word indexes by role, or undefined when the roles are not evident.
// `Имя Отчество Фамилия` is checked first so that surnames in -ич, as in
// `Шостакович Дмитрий Дмитриевич`, are not mistaken for patronymics.
export function russianNameRoles(words, known = isGivenName) {
  if (words.length === 3) {
    if (isPatronymic(words[1])) {
      return { given: 0, patronymic: 1, surname: 2 };
    }
    return isPatronymic(words[2])
      ? { surname: 0, given: 1, patronymic: 2 }
      : undefined;
  }
  if (words.length !== 2) {
    return undefined;
  }
  if (isPatronymic(words[1])) {
    return { given: 0, patronymic: 1 };
  }
  const candidates = [0, 1].filter(
    (i) => surname.test(words[i]) && !known(words[i])
  );
  return candidates.length === 1
    ? { surname: candidates[0], given: 1 - candidates[0] }
    : undefined;
}
