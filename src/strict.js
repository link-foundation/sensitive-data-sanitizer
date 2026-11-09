import { collectMatches } from './detection.js';
import { months } from './personal-context.js';
import { isDocumentTechnology } from './document-experience.js';
import { placeholderValues } from './placeholders.js';
import { generatedValues } from './fake.js';

const boundary = '[\\p{L}\\p{N}_]';
const attributes =
  /(?<![\p{L}\p{N}_])(?:женщин[аыуеой]{1,2}|мужчин[аыуеой]{1,2}|замужем|женат(?:а|ы)?|(?:один|одна|двое|трое|четверо|пятеро|\d{1,2})[ \t]+(?:детей|реб[её]нок|реб[её]нка)|русск(?:ая|ий|ого|ой|ие)|татар(?:ин|ка|ы)|православн(?:ый|ая|ого|ой)|мусульман(?:ин|ка)|инвалидност[ьи](?:[ \t]+\d[ \t]+группы)?|беременн(?:а|ая|ость)|судимость(?:[ \t]+погашена)?|член[ \t]+партии|woman|women|man|men|male|female|married|divorced|pregnant|pregnancy|disabled|disability|christian|muslim|jewish|orthodox|russian|hispanic|asian|criminal[ \t]+record|party[ \t]+member|(?:one|two|three|\d{1,2})[ \t]+children)(?![\p{L}\p{N}_])/giu;
const additionalAttributes =
  /(?<![\p{L}\p{N}_])(?:диабет(?:ом|а|у|е)?|ВИЧ(?:-положительн(?:ый|ая|ого|ой))?|болен|больна|больны|католик(?:ом|а|и)?|католичк(?:а|ой|и)|буддист(?:ка|кой|ом|а|ы)?|атеист(?:ка|кой|ом|а|ы)?|украин(?:ец|ка|цы|цем|кой)|белорус(?:ка|кой|ом|а|ы)?|несудим(?:а|ы)?|судим(?:а|ы)?|член[ \t]+политической[ \t]+партии|холост(?:а|ы)?|развед[её]н(?:а|ы)?|в[ \t]+разводе|diabetes|diabetic|HIV(?:[ \t-]+positive)?|cancer|buddhist|catholic|atheist|ukrainian|belarusian|previous[ \t]+conviction|member[ \t]+of[ \t]+(?:a[ \t]+)?(?:political[ \t]+)?party|single|unmarried|widowed)(?![\p{L}\p{N}_])/giu;

function isDuration(text, match, replacements) {
  // Keep cues on the same clause; an age on the next line is independent.
  let prefix = text.slice(Math.max(0, match.index - 128), match.index);
  // Verification scans transformed text too. Keep its duration cues equivalent
  // to the default redaction view, including custom placeholder spellings.
  for (const { value } of replacements) {
    prefix = prefix.replaceAll(value, '[REDACTED]');
  }
  prefix = prefix.split(/[\r\n;|]/u).at(-1);
  const suffix = text.slice(match.index + match[0].length);
  if (
    /(?<![\p{L}\p{N}_])(?:мне|ему|ей|кандидату|кандидатке|исполнилось|возраст)[ \t]*:?[ \t]*$/iu.test(
      prefix
    )
  ) {
    return false;
  }
  if (
    /(?<![\p{L}\p{N}_])(?:опыт(?:[ \t]+работы)?|стаж|experience|duration)[ \t]*:?[ \t]*$/iu.test(
      prefix
    ) ||
    /(?<![\p{L}\p{N}_])(?:за(?:[ \t]+последние)?|через|спустя|более|на|длился|длилась)[ \t]+$/iu.test(
      prefix
    ) ||
    /(?<![\p{L}\p{N}_])(?:работал[аи]?|проработал[аи]?|\[REDACTED\](?=[ \t]+(?:там|в)(?![\p{L}\p{N}_])))(?:[ \t]+(?:[\p{L}-]{1,48}|\[REDACTED\])){0,3}[ \t]+$/iu.test(
      prefix
    ) ||
    /^[ \t]+(?:опыта|стажа|работы)(?![\p{L}\p{N}_])/iu.test(suffix)
  ) {
    return true;
  }
  const skill =
    /([\p{L}\p{N}+#.-]+(?:[ \t]+[\p{L}\p{N}+#.-]+)?)[ \t]+\([ \t]*$/u
      .exec(prefix)?.[1]
      ?.replace(/[ \t]+/gu, ' ') ?? '';
  return (
    /^[ \t]*\)/u.test(suffix) &&
    (isDocumentTechnology(skill) ||
      isDocumentTechnology(skill.split(' ').at(-1)) ||
      /\[REDACTED\][ \t]+\([ \t]*$/u.test(prefix))
  );
}

export function detectStrict(text, emit, options) {
  if (!options.strict) {
    return;
  }
  for (const pattern of [attributes, additionalAttributes]) {
    collectMatches(text, pattern, emit, {
      type: 'PERSONAL_ATTRIBUTE',
      rule: 'strict-attribute',
      category: 'personal',
      confidence: 0.9,
    });
  }
  const date = new RegExp(
    `(?<!${boundary})(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[./]\\d{1,2}[./]\\d{4}|\\d{1,2}[ \\t]+(?:${months})[ \\t]+\\d{4})(?!${boundary}|[Tt]\\d)`,
    'giu'
  );
  collectMatches(text, date, emit, {
    type: 'DATE',
    rule: 'strict-date',
    category: 'personal',
    confidence: 0.9,
  });
  const replacements = [
    ...placeholderValues(options),
    ...generatedValues(options),
  ].filter((entry) => !entry.credential);
  collectMatches(
    text,
    /(?<![\p{L}\p{N}_])\d{1,3}[ \t]+(?:год|года|лет|years?[ \t]+old)(?![\p{L}\p{N}_])/giu,
    emit,
    { type: 'AGE', rule: 'strict-age', category: 'personal', confidence: 0.9 },
    0,
    (_value, match) => !isDuration(text, match, replacements)
  );
  for (const [type, pattern] of [
    [
      'PASSPORT_NUMBER',
      /(?<![\p{L}\p{N}_])(?:\d{2}[ \t]\d{2}[ \t]\d{6}|\d{10})(?![\p{L}\p{N}_])/gu,
    ],
    [
      'PHONE',
      /(?<![\p{L}\p{N}_])(?:[78][ \t-]?)?9\d{2}[ \t-]?\d{3}[ \t-]?\d{2}[ \t-]?\d{2}(?![\p{L}\p{N}_])/gu,
    ],
    ['POSTAL_CODE', /(?<![\p{L}\p{N}_])\d{6}(?![\p{L}\p{N}_])/gu],
  ]) {
    collectMatches(
      text,
      pattern,
      emit,
      { type, rule: 'strict-number', category: 'personal', confidence: 0.9 },
      0,
      (value, match) =>
        !/^[ \t]*(?:ns|ms|µs|us|seconds?|bytes?|kb|mb|gb)\b/iu.test(
          text.slice(match.index + value.length)
        )
    );
  }
}
