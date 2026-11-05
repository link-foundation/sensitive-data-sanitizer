import { firstNames } from './names.js';

// Finite Russian name grammar shared by known-value matching and fake mode.
const patronymic = /(?:ич|овна|евна|ична|vich|ovna|evna)$/iu;
const surname = /(?:ов|ев|ин|ын|ский|цкий|ова|ева|ина|ына|ская|цкая)$/iu;
const fold = (word) => word.toLowerCase().replaceAll('ё', 'е');
const givenNames = new Set(firstNames.ru.split(' ').map(fold));

export const isPatronymic = (word) => patronymic.test(word);
export const isGivenName = (word) => givenNames.has(fold(word));

// Only decides whether a word beside a known person belongs to that mention, so
// it stays apart from the detector's list, which would match these names anywhere.
const mentionGivenNames =
  'Роман Антон Илья Артём Никита Егор Глеб Денис Игорь Константин Кирилл Леонид Матвей Тимофей Фёдор Руслан Станислав Вячеслав Вадим Валерий Геннадий Григорий Степан Тимур Ярослав Юлия Дарья Полина Ксения Виктория Анастасия Вероника Валерия Алёна Оксана Людмила Галина Лариса Надежда Вера Любовь Кристина Софья Диана Яна Лилия Альбина Жанна Регина Инна Карина Милана Арина Варвара Елизавета Маргарита';
const anyGivenName = new Set(
  [...Object.values(firstNames), mentionGivenNames]
    .flatMap((list) => list.split(' '))
    .map(fold)
);
const inflectedPatronymic =
  /(?:[оеь]вич|[оеь]ич|ич)(?:а|у|ем|е)?$|(?:овн|евн|ичн)(?:а|ы|е|у|ой|ою)$/iu;
const nameCase = /(?:ом|ем|ой|ей|ою|ею|а|я|у|ю|е|ы|и)$/u;
// A capitalized given name or patronymic in any case, for deciding whether a
// neighbouring word belongs to the same mention. Lemmas are recovered by a
// finite ending list, so this stays a lookup and never parses the sentence.
export function isNameForm(word) {
  const lower = fold(word);
  if (anyGivenName.has(lower) || inflectedPatronymic.test(lower)) {
    return true;
  }
  const stem = lower.replace(nameCase, '');
  return (
    stem !== lower &&
    stem.length >= 2 &&
    ['', 'а', 'я', 'й', 'ь'].some((ending) => anyGivenName.has(stem + ending))
  );
}

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
