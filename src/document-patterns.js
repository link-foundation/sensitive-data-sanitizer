import { firstNames } from './names.js';
import { isNameForm } from './russian-names.js';

const boundary = '[\\p{L}\\p{N}_]';
const word = '[А-ЯЁ][а-яё-]{1,47}';
const surname =
  '[А-ЯЁа-яё][А-ЯЁа-яё-]{1,28}(?:ов|ев|ин|ын|ск|цк)(?:а|ой|ою|у|ым|ом|е|ы|и|их|ий|ая|ого|ому|ую|ие)?';
const initials = '(?:[А-ЯЁA-Z]\\.[ \\t]*){1,2}';
const latinSurname = '[A-Z][a-z]{1,28}(?:ova|eva|ov|ev|in|ina|sky|ski|skaya)';
const given = [
  ...new Set(Object.values(firstNames).flatMap((s) => s.split(' '))),
].join('|');
const nameInitials = new RegExp(
  `(?<!${boundary})(?:${word}[ \\t]+(?:[А-ЯЁ]\\.[ \\t]*){2}|${surname}[ \\t]+${initials}|${initials}(?:${surname}|${latinSurname})|${latinSurname}[ \\t]+${initials}|(?:${given})[ \\t]+[А-ЯЁA-Z]\\.)(?!${boundary})`,
  'gu'
);
const namePairs = new RegExp(
  `(?<!${boundary})(${surname})[ \\t]+([А-ЯЁа-яё]{2,32})|(?<!${boundary})([А-ЯЁа-яё]{2,32})[ \\t]+(${surname})(?!${boundary})`,
  'gu'
);
// Every rule is finite and requires either an identifying structure or a label.
// Public locations/ambiguous bare words are not inferred from arbitrary prose.
const rules = [
  [
    'PHONE',
    'document-phone',
    /(?<![\p{L}\p{N}_])(?:[78][ .-]?)?9\d{2}(?:[ .-]\d{3}[ .-]\d{2}[ .-]\d{2})(?!\d)|(?<![\p{L}\p{N}_])8[ .-]?\(9\d{2}\)[ .-]?\d{3}[ .-]?\d{2}[ .-]?\d{2}(?!\d)/gu,
    0,
  ],
  [
    'PHONE',
    'document-phone-label',
    /(?<![\p{L}\p{N}_])(?:(?:контактный[ \t]+)?телефон|контакт|тел\.?|моб\.?|сот\.?|WhatsApp)(?:[ \t]*:[ \t]*|[ \t]+)((?:[78][ () .-]*)?9\d{2}[ () .-]*\d{3}[ .-]*\d{2}[ .-]*\d{2})(?!\d)/giu,
    1,
  ],
  [
    'EMAIL',
    'obfuscated-email',
    /(?<![\p{L}\p{N}_.+\\-])[\p{L}\p{N}_+-]{1,64}(?:(?:\.|[ \t]{1,8}dot[ \t]{1,8})[\p{L}\p{N}_+-]{1,64}){0,4}(?:[ \t]{0,8}\((?:at|собака)\)[ \t]{0,8}|[ \t]{0,8}\[at\][ \t]{0,8}|[ \t]{1,8}(?:at|собака)[ \t]{1,8})[\p{L}\p{N}-]{1,63}(?:(?:\.|[ \t]{1,8}dot[ \t]{1,8})[\p{L}\p{N}-]{1,63}){1,8}(?![\p{L}\p{N}_])/giu,
    0,
  ],
  [
    'USERNAME',
    'personal-profile-url',
    /(?<![\p{L}\p{N}_./-])(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in|github\.com|vk\.com|instagram\.com|t\.me|wa\.me)\/[\p{L}\p{N}_][\p{L}\p{N}_.-]{1,100}(?:\/[\p{L}\p{N}_.-]{1,100}){0,4}(?![\p{L}\p{N}_])/giu,
    0,
  ],
  [
    'USERNAME',
    'messenger-label',
    /(?<![\p{L}\p{N}_])(?:Telegram|телеграм|телега|tg|skype|Zoom|ник)(?:[ \t]*:[ \t]*|[ \t]+)(@?[a-z][a-z\d_.-]{2,63})(?![\p{L}\p{N}_])/giu,
    1,
  ],
  [
    'PASSPORT_NUMBER',
    'passport-series',
    /(?<![\p{L}\p{N}_])(?:серия|series)[ \t]+(\d{2}[ \t]?\d{2}[ \t]+(?:№|No|номер|number|#)[ \t]*\d{6})(?!\d)/giu,
    1,
  ],
  [
    'ID',
    'identity-number',
    /(?<![\p{L}\p{N}_])(?:ОГРНИП[ \t]+(\d{15})|код подразделения[ \t]+(\d{3}-\d{3})|(?:водительское удостоверение|в\/у|Driver's licen[cs]e)[ \t]+(\d{2}[ \t]?\d{2}[ \t]?\d{6})|(?:ОМС|полис)[ \t]+(\d{16})|(?:сч[её]т|р\/с)[ \t]+(\d{20})|диплом[ \t]+(?:№|No|#)[ \t]*(\d{6}))(?!\d)/giu,
    -1,
  ],
  [
    'ID',
    'passport-issuer',
    /(?<![\p{L}\p{N}_])выдан[ \t]+((?:ОВД|УВД|МВД|(?:ТП[ \t]+)?УФМС)[ \t]+[^\r\n";|]{1,120}?\d{2}\.\d{2}\.\d{4})(?!\d)/giu,
    1,
  ],
  [
    'EDUCATION',
    'numbered-school',
    /(?<![\p{L}\p{N}_])(?:школа|гимназия|лицей|колледж)[ \t]*(?:№|No|#|:)[ \t]*\d{1,4}(?!\d)/giu,
    0,
  ],
  [
    'EDUCATION',
    'school-acronym-context',
    /(?<![\p{L}\p{N}_])(?:образование|ВУЗ|университет|учил(?:ся|ась)[ \t]+в|окончил[аи]?)(?:[ \t]*:[ \t]*|[ \t]+)([А-ЯЁ]{2,12}(?:[ \t]+им\.[ \t]+[А-ЯЁ][а-яё-]{2,40})?)(?![\p{L}\p{N}_])/giu,
    1,
  ],
  [
    'EDUCATION',
    'education-label',
    /(?<![\p{L}\p{N}_])Education[ \t]*:[ \t]*([\p{Lu}][\p{L}.-]{1,47})(?![\p{L}\p{N}_])/gu,
    1,
  ],
  [
    'PERSONAL_ATTRIBUTE',
    'profile-prose',
    /(?<![\p{L}\p{N}_])(?:граждан(?:ин|ка)[ \t]+([А-ЯЁ]{2,4})|есть[ \t]+((?:один|одна|двое|трое|четверо|пятеро|\d{1,2})[ \t]+(?:детей|реб[её]нок|реб[её]нка)))(?![\p{L}\p{N}_])/gu,
    -1,
  ],
  ['PERSON', 'name-initials', nameInitials, 0],
  [
    'PERSON',
    'name-title',
    new RegExp(
      `(?<!${boundary})(?:г-жа|г-н|господин|госпожа)[ \\t]+(${word})(?!${boundary})`,
      'gu'
    ),
    1,
  ],
  [
    'DATE_OF_BIRTH',
    'birth-year',
    /(?<![\p{L}\p{N}_])(?:д\.р\.|г\.р\.|год рождения|родил(?:ся|ась)(?:[ \t]+в)?|Born(?:[ \t]+in)?)[ \t]*:?[ \t]*((?:19|20)\d{2})(?!\d)|(?<!\d)((?:19|20)\d{2})(?=[ \t]+(?:г\.р\.|года[ \t]+рождения)(?![\p{L}\p{N}_]))/giu,
    -1,
  ],
  [
    'AGE',
    'age-context',
    /(?<![\p{L}\p{N}_])(?:(?:возраст|Age)(?:[ \t]*:[ \t]*|[ \t]+)|(?:мне|исполнилось)[ \t]+)(\d{1,3})(?!\d)|(?<![\p{L}\p{N}_])(?:Женщина|Мужчина),[ \t]*(\d{1,3})(?=[ \t]+(?:года|год|лет)(?![\p{L}\p{N}_]))/giu,
    -1,
  ],
  [
    'GENDER',
    'gender-context',
    /(?<![\p{L}\p{N}_])(?:Пол|Sex)(?:[ \t]*:[ \t]*|[ \t]+)(женский|мужской|жен\.|муж\.|Ж|М|male|female)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(Женщина|Мужчина)(?=,[ \t]*\d{1,3}[ \t]+(?:года|год|лет))/giu,
    -1,
  ],
  [
    'PERSONAL_ATTRIBUTE',
    'profile-attribute',
    /(?<![\p{L}\p{N}_])(?:Гражданство|Citizenship|Семейное положение|Marital status|Дети|национальность|Вероисповедание|инвалидность|судимость)[ \t]*:[ \t]*([^\\\r\n";|]{1,160})/giu,
    1,
  ],
  [
    'ORGANIZATION',
    'employer-label',
    /(?<![\p{L}\p{N}_])(?:Компания|Работодатель|Место работы|Company|Employer)[ \t]*:[ \t]*([\p{Lu}][^,;|\\\r\n":]{0,159})/giu,
    1,
  ],
  [
    'ORGANIZATION',
    'employer-prose',
    new RegExp(
      `(?<!${boundary})(?:компания|работал[аи]?[ \\t]+в|холдинг|[Бб]анк)[ \\t]+(«[^«»\\r\\n]{1,120}»|${word})(?!${boundary})`,
      'gu'
    ),
    1,
  ],
  [
    'ORGANIZATION',
    'employer-years',
    new RegExp(
      `(?:^|\\n)[ \\t]*(?:19|20)\\d{2}[–—-](?:19|20)\\d{2}[ \\t]+(${word})(?!${boundary})`,
      'gu'
    ),
    1,
  ],
  [
    'LOCATION',
    'residence-prose',
    new RegExp(
      `(?<!${boundary})(?:(?:живу|проживаю)[ \\t]+в|из|м\\.|метро|район)[ \\t]+(${word})(?!${boundary})`,
      'gu'
    ),
    1,
  ],
  [
    'LOCATION',
    'postal-code',
    /(?<![\p{L}\p{N}_])индекс[ \t]+(\d{6})(?!\d)|(?<!\d)(\d{6})(?=,[ \t]*[А-ЯЁ][а-яё-]{2,47})/gu,
    -1,
  ],
];

export function detectDocumentPatterns(text, emit) {
  for (const [type, rule, pattern, group] of rules) {
    for (const match of text.matchAll(pattern)) {
      const value =
        group === -1
          ? match.slice(1).find((part) => part !== undefined)
          : match[group].trim();
      if (
        !documentValueAllowed(rule, value) ||
        (rule === 'profile-attribute' &&
          /^Дети[ \t]*:/iu.test(match[0]) &&
          /^нет$/iu.test(value))
      ) {
        continue;
      }
      const start =
        match.index + (group === 0 ? 0 : match[0].lastIndexOf(value));
      emit({
        start,
        end: start + value.length,
        type,
        rule,
        category: 'personal',
        confidence: group === -1 ? 0.85 : 0.75,
      });
    }
  }
  for (const match of text.matchAll(namePairs)) {
    if (isNameForm(match[2] ?? match[3])) {
      emit({
        start: match.index,
        end: match.index + match[0].length,
        type: 'PERSON',
        rule: 'name-case',
        category: 'personal',
        confidence: 0.8,
      });
    }
  }
  // An address at line start or in explicit residence context is personal.
  // Public-place prose with a street address does not supply that context.
  const street =
    /(?:^|\n)[ \t]*((?:ул\.|улица)[ \t]+[А-ЯЁ][а-яё-]{1,40},[ \t]*(?:(?:д\.|дом)[ \t]*)?\d{1,5}(?:[ \t]*,[ \t]*кв\.[ \t]*\d{1,5})?)|проживает по адресу[ \t]+((?:ул\.|улица)[ \t]+[А-ЯЁ][а-яё-]{1,40},[ \t]*(?:(?:д\.|дом)[ \t]*)?\d{1,5}(?:[ \t]*,[ \t]*кв\.[ \t]*\d{1,5})?)/gu;
  for (const match of text.matchAll(street)) {
    const value = match[1] ?? match[2];
    const start = match.index + match[0].lastIndexOf(value);
    emit({
      start,
      end: start + value.length,
      type: 'ADDRESS',
      rule: 'document-street',
      category: 'personal',
      confidence: 0.85,
    });
  }
}

function documentValueAllowed(rule, value) {
  return (
    Boolean(value) &&
    value !== '[REDACTED]' &&
    !(
      rule === 'school-acronym-context' &&
      !/^[А-ЯЁ]{2,12}(?![А-ЯЁа-яё])/.test(value)
    ) &&
    !(
      rule === 'profile-attribute' &&
      /^(?:не указан[оаы]?|not specified|unknown|n\/a)$/iu.test(value)
    ) &&
    !(rule === 'messenger-label' && /^(?:недоступен|unavailable)$/i.test(value))
  );
}
