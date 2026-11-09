import { collectMatches, escapePattern } from './detection.js';
import { firstNames } from './names.js';
import { organizationCore, personalRegex } from './personal-variants.js';
import { documentVocabulary } from './document-vocabulary.js';
import { documentDateRange as range } from './document-dates.js';
import { detectDocumentExtras } from './document-extras.js';
import { detectDocumentPatterns } from './document-patterns.js';
import { isDocumentTechnology } from './document-experience.js';
import { detectVocabulary } from './vocabulary.js';
import { detectDocumentPersonCues } from './document-person-cues.js';
import { detectDocumentCatalog } from './document-catalog.js';

const words = (column) =>
  [...new Set(documentVocabulary.flatMap((row) => row[column].split('|')))]
    .sort((a, b) => b.length - a.length)
    .map(escapePattern)
    .join('|');
const legal = words(1),
  school = words(2);
const proper = "[\\p{Lu}][\\p{L}\\p{M}’'&.-]{1,47}";
const latinName = `${proper}(?:[ \\t]+${proper}){0,5}`;
// Scripts without letter case need a bounded script-specific name instead.
const uncased =
  '[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}\\p{Script=Arabic}\\p{Script=Hebrew}\\p{Script=Devanagari}\\p{Script=Thai}\\p{M}]{2,48}';
const name = `(?:${latinName}|${uncased}(?:[ \\t]+${uncased}){0,3})`;
const quoted = `(?:«[^«»\\r\\n]{1,160}»|“[^“”\\r\\n]{1,160}”|"[^"\\r\\n]{1,160}"|「[^「」\\r\\n]{1,160}」|『[^『』\\r\\n]{1,160}』|${name})`;
const boundary = '[\\p{L}\\p{M}\\p{N}_]';
const organizations = new RegExp(
  `(?<!${boundary})(?:(?:${legal})[ \\t]*${quoted}|${quoted}[ \\t]*(?:${legal}))(?!${boundary})`,
  'gu'
);
const schools = new RegExp(
  `(?<!${boundary})(?:(?:${school})[ \\t]*${quoted}|${quoted}[ \\t]*(?:${school}))(?!${boundary})`,
  'gu'
);
const places = new RegExp(
  `(?<!${boundary})(?:${words(3)})(?!${boundary})`,
  'gu'
);
const labelledPlace = new RegExp(
  `(?<!${boundary})(?:[Bb]ased in|[Ll]ocated in|[Rr]elocated from|город|г\\.|местоположение|ubicado en|situé à|ansässig in|localizado em|所在地|位于|位於|위치|يقيم في|ממוקם ב|स्थित|merkezi|berlokasi di|đặt tại|ตั้งอยู่ที่)[ \\t]+(${name})(?!${boundary})`,
  'gu'
);

const ruWord = '[А-ЯЁа-яё][А-ЯЁа-яё-]{1,47}';
const ruSchool = new RegExp(
  `(?<!${boundary})[А-ЯЁ][а-яё]{2,30}(?:-[А-ЯЁа-яё][а-яё]{1,30})?(?:[ \t]+[а-яё-]{2,40}){0,4}[ \t]+(?:университет|институт|колледж|школа|академия)(?:[ \t]+имени[ \t]+${ruWord}(?:[ \t]+[А-ЯЁ][а-яё-]{2,40}){0,2})?(?!${boundary})`,
  'gu'
);
const ruAcronym =
  /(?<![\p{L}\p{N}_])(?:НИУ[ \t]+[А-ЯЁ]{2,12}|(?:МГУ|СПбГУ|МГТУ|РГГУ|ВШЭ)(?=[, \t]+(?:магистратура|бакалавриат|университет|обучение)))(?![\p{L}\p{N}_])/gu;
const ruResidence =
  /(?:[Гг]ород|[Пп]роживаю|[Пп]роживание|[Мм]есто жительства)[ \t]*:[ \t]*([А-ЯЁ][а-яё-]{2,47})|([А-ЯЁ][а-яё-]{2,47})(?=,[ \t]*(?:готов[а]?[ \t]+к[ \t]+переезду|Россия|Беларусь|Казахстан|Украина))/gu;
const ruIntroduction = new RegExp(
  `(?:[Мм]еня зовут|[Сс] уважением)[, \t\r\n]+(${firstNames.ru.split(' ').join('|')})(?!${boundary})`,
  'gu'
);
const groupOrganization = new RegExp(
  `(?<!${boundary})${latinName}[ \t]+(?:Групп|Group|Холдинг|Holding)(?!${boundary})`,
  'gu'
);
// CV experience lines: the date range anchors the employer slot, so prose with
// a comma is untouched. Titles are not required to be lowercase because English
// ones are often title case (`Senior QA Engineer`).
const titleWord = '[\\p{L}\\p{N}][\\p{L}\\p{N}/+#.&-]{0,39}';
// A segment starts a line or follows `|`. `Опыт:` or `Опыт -` before the title
// reads like a list marker: the date range remains the anchor of the rule.
const lineLabel = `\\p{L}[\\p{L}\\p{N}/+#.&-]{0,39}(?:[ \\t]+${titleWord})?(?:[ \\t]*:[ \\t]*|[ \\t]+[-–—][ \\t]+)`;
const lineTitle = `(?:^|(?<=\\|))[ \\t]*(?:[-–—•*·][ \\t]+|\\d{1,2}[.)][ \\t]+)?(?:${lineLabel}){0,2}${titleWord}(?:[ \\t]+${titleWord}){0,8}`;
const employerWord = "[\\p{L}\\p{M}\\p{N}&'’.+-]{1,40}";
const employer = `«[^«»\\r\\n]{1,160}»|"[^"\\r\\n]{1,160}"|“[^“”\\r\\n]{1,160}”|(?:\\p{Lu}|\\d{1,4}-?\\p{L})${employerWord}?(?:[ \\t]+${employerWord}){0,5}`;
const experienceLine = new RegExp(
  `${lineTitle}(?:,[ \\t]+|[ \\t]+[-–—][ \\t]+)(${employer})(?:[ \\t]*\\(${range}\\)|[ \\t]*[,–—-][ \\t]*${range})`,
  'gmu'
);
const experienceParenthesis = new RegExp(
  `${lineTitle}[ \\t]*\\((${employer})\\)(?:,?[ \\t]*${range}|[ \\t]*\\(${range}\\))`,
  'gmu'
);

export function detectDocumentEntities(text, emit, options) {
  if (!options.documentEntities) {
    return;
  }
  detectVocabulary(text, emit, options);
  detectDocumentPersonCues(text, emit);
  detectDocumentCatalog(text, emit);
  detectDocumentPatterns(text, emit);
  detectDocumentExtras(text, emit, range, options.debug, options);
  collectMatches(
    text,
    new RegExp(
      `(?:^|[\\r\\n])[ \\t]*[^|\\r\\n]{1,120}\\|[ \\t]*(${name})[ \\t]*\\|[ \\t]*${range}`,
      'gu'
    ),
    emit,
    {
      type: 'ORGANIZATION',
      rule: 'organization-experience',
      category: 'personal',
      confidence: 0.85,
    },
    1,
    (value) => !isDocumentTechnology(value)
  );
  const found = [];
  const capture = (finding) => {
    found.push(finding);
    emit(finding);
  };
  for (const [type, rule, pattern, group, confidence] of [
    ['ORGANIZATION', 'organization-group', groupOrganization, 0, 0.7],
    ['EDUCATION', 'education-russian', ruSchool, 0, 0.65],
    ['EDUCATION', 'education-acronym', ruAcronym, 0, 0.65],
    ['PERSON', 'document-introduction', ruIntroduction, 1, 0.7],
    ['ORGANIZATION', 'organization-legal-form', organizations, 0, 0.7],
    ['EDUCATION', 'education-type', schools, 0, 0.65],
    ['LOCATION', 'location-gazetteer', places, 0, 0.6],
    ['LOCATION', 'location-label', labelledPlace, 1, 0.75],
    ['ORGANIZATION', 'organization-experience', experienceLine, 1, 0.6],
    ['ORGANIZATION', 'organization-experience', experienceParenthesis, 1, 0.6],
  ]) {
    collectMatches(
      text,
      pattern,
      capture,
      { type, rule, category: 'personal', confidence },
      group,
      (value) =>
        type !== 'ORGANIZATION' ||
        (!isDocumentTechnology(value) && value !== 'ОГРНИП')
    );
  }
  for (const match of text.matchAll(ruResidence)) {
    const value = match[1] ?? match[2];
    const start = match.index + match[0].lastIndexOf(value);
    emit({
      start,
      end: start + value.length,
      type: 'LOCATION',
      rule: 'location-residence',
      category: 'personal',
      confidence: 0.75,
    });
  }
  // Organization cores are confirmed only by a bounded legal-form finding.
  for (const finding of found.filter((f) => f.type === 'ORGANIZATION')) {
    const core = organizationCore(text.slice(finding.start, finding.end));
    if (core.length < 3 || core.length > 256) {
      continue;
    }
    for (const match of text.matchAll(personalRegex(core, 'ORGANIZATION'))) {
      emit({
        ...finding,
        start: match.index,
        end: match.index + match[0].length,
        rule: 'organization-core',
      });
    }
  }
}
