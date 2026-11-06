import { collectMatches } from './detection.js';
import { months } from './personal-context.js';

const boundary = '[\\p{L}\\p{N}_]';
const attributes =
  /(?<![\p{L}\p{N}_])(?:женщин[аыуеой]{1,2}|мужчин[аыуеой]{1,2}|замужем|женат(?:а|ы)?|(?:один|одна|двое|трое|четверо|пятеро|\d{1,2})[ \t]+(?:детей|реб[её]нок|реб[её]нка)|русск(?:ая|ий|ого|ой|ие)|татар(?:ин|ка|ы)|православн(?:ый|ая|ого|ой)|мусульман(?:ин|ка)|инвалидност[ьи](?:[ \t]+\d[ \t]+группы)?|беременн(?:а|ая|ость)|судимость(?:[ \t]+погашена)?|член[ \t]+партии|woman|women|man|men|male|female|married|divorced|pregnant|pregnancy|disabled|disability|christian|muslim|jewish|orthodox|russian|hispanic|asian|criminal[ \t]+record|party[ \t]+member|(?:one|two|three|\d{1,2})[ \t]+children)(?![\p{L}\p{N}_])/giu;

export function detectStrict(text, emit, options) {
  if (!options.strict) {
    return;
  }
  collectMatches(text, attributes, emit, {
    type: 'PERSONAL_ATTRIBUTE',
    rule: 'strict-attribute',
    category: 'personal',
    confidence: 0.9,
  });
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
  collectMatches(
    text,
    /(?<![\p{L}\p{N}_])\d{1,3}[ \t]+(?:год|года|лет|years?[ \t]+old)(?![\p{L}\p{N}_])/giu,
    emit,
    { type: 'AGE', rule: 'strict-age', category: 'personal', confidence: 0.9 },
    0,
    (_value, match) =>
      !/(?:опыт(?:[ \t]+работы)?|стаж|experience|duration|за|через|спустя)[ \t]*$/iu.test(
        text.slice(Math.max(0, match.index - 64), match.index)
      )
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
