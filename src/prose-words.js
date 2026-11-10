import { isNameForm } from './russian-names.js';
import { compiledVocabulary, defaultVocabulary } from './vocabulary.js';

// Words that are capitalized by position or politeness in prose but identify
// nobody. `properNames: 'capitalized'` leaves them readable. Any word that is
// also a given name form (`Вера`, `Любовь`, `Will`) is removed from the lists,
// so a list entry can never keep a name.
const fold = (word) => word.toLowerCase().replaceAll('ё', 'е');
const words = (list) =>
  new Set(
    list
      .split(/\s+/u)
      .filter(Boolean)
      .map(fold)
      .filter((word) => !isNameForm(word))
  );

// Pronouns are capitalized anywhere in polite Russian (`благодарим Вас`).
const pronouns = words(`
  я меня мне мной мы нас нам нами ты тебя тебе тобой вы вас вам вами
  ваш ваша ваше вашего вашей вашему вашим ваши ваших
  наш наша наше нашего нашей нашему нашим наши наших
  мой моя мое моего моей моему моим мои моих
  твой твоя твое твои он она оно они его ее ему ей им ими их них нее него
  i me my mine we us our you your he him his she her they them their
`);
// Role and label words stay beside the name they introduce
// (`Кандидат Петров Иван Сергеевич` -> `Кандидат Person-1`).
const cues = words(`
  кандидат кандидатка кандидата кандидату соискатель соискательница соискателя
  сотрудник сотрудница сотрудника клиент клиентка клиента пациент пациентка
  пациента абонент абонента заявитель заявительница заявителя студент
  студентка гражданин гражданка господин госпожа коллега коллеги менеджер
  директор руководитель инженер аналитик разработчик специалист водитель врач
  candidate employee client customer patient applicant student citizen
  colleague manager director engineer developer analyst
`);
// Greetings and function words are left alone only at the start of a
// sentence, where capitalization says nothing about a name.
const sentenceWords = words(`
  здравствуйте здравствуй привет приветствую добрый доброе доброго добрая
  уважаемый уважаемая уважаемые дорогой дорогая дорогие спасибо благодарю
  благодарим пожалуйста извините простите скажите подскажите прошу просьба
  это этот эта эти тот та те то там тут здесь где когда как что кто чем
  почему зачем если но и а или да нет не ни в во на по с со к ко у о об от до
  из за для при без про после перед также тоже еще уже вот так все весь вся
  каждый сейчас сегодня вчера завтра потом затем далее итак кроме однако
  поэтому хотя возможно конечно хорошо ладно ок буду будет был была были было
  есть могу можно нужно надо готов готова готовы имею хочу работаю живу
  учусь зовут звать занимаюсь звоню пишу
  нёс перенёс принёс вёз привёз мог смог помог умер рос вырос лёг шёл пришёл
  ушёл перешёл нашёл
  hello hi hey dear thanks thank please regards sincerely best the this that
  these those a an it is are was were in on at for from to with and but or if
  when where what who why how yes no not also
`);
// Past tense (`Работал`, `Звонила`, `Переехали`), first person present
// (`Работаю`, `Занимаюсь`) and third person present. A bare masculine `-л` form is also a surname shape
// (`Шагал`), so it is kept only before a lowercase word.
const pastTense = /^[а-яе]{2,}[аеиоуыя]л(?:а|о|и|ся|ась|ось|ись)$/u;
const masculinePast = /^[а-яе]{3,}[аеиуыя]л$/u;
const firstPerson = /^[а-яе]{3,}[аеуя]ю(?:сь)?$/u;
// Third person present (`Рекомендует`, `Работает`, `Говорит`, `Учатся`).
const thirdPerson =
  /^[а-яе]{2,}(?:[аеиоуюя]ет|[аеиоуюя]ют|ит|ят|[аеиуя]ется|[аеиуя]ются|ится|атся|ятся)$/u;

function sentenceStart(text, start) {
  let i = start - 1;
  while (i >= 0 && /[ \t"'«„“(—–-]/u.test(text[i])) {
    i--;
  }
  return i < 0 || /[.!?…\r\n:;]/u.test(text[i]);
}
function nextWordLowercase(text, end) {
  return /^[ \t]+\p{Ll}/u.test(text.slice(end, end + 4));
}
function vocabularyCues(options) {
  const lists = compiledVocabulary(options?.vocabulary)?.lists;
  return lists ? [...lists.roles, ...lists.personalLabels] : [];
}
const defaultCues = new Set(
  [...defaultVocabulary.roles, ...defaultVocabulary.personalLabels].map(fold)
);

// True when a word of the cue lists, including the configured `roles` and
// `personalLabels` vocabulary, is not part of a name.
export function isProseCue(word, options) {
  const lower = fold(word);
  return (
    (cues.has(lower) ||
      defaultCues.has(lower) ||
      vocabularyCues(options).includes(lower)) &&
    !isNameForm(word)
  );
}
// True for a pronoun or cue word, which identify nobody wherever they stand.
export function isCommonProseWord(word, options) {
  return pronouns.has(fold(word)) || isProseCue(word, options);
}
// Decides whether a capitalized prose token is an ordinary word of the
// sentence and not a name.
export function keepsProseWord(text, value, start, end, options) {
  if (!/^\p{L}+$/u.test(value) || isNameForm(value)) {
    return false;
  }
  if (isCommonProseWord(value, options)) {
    return true;
  }
  if (!sentenceStart(text, start)) {
    return false;
  }
  const lower = fold(value);
  return (
    sentenceWords.has(lower) ||
    pastTense.test(lower) ||
    firstPerson.test(lower) ||
    thirdPerson.test(lower) ||
    (masculinePast.test(lower) && nextWordLowercase(text, end))
  );
}
