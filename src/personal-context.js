import { collectMatches } from './detection.js';

const birth =
  /(?<![\p{L}\p{N}_])(?:born|birth[ _-]?date|date[ _-]of[ _-]birth|DOB|дата рождения|д\.р\.|родился|родилась|Geburtsdatum|fecha de nacimiento|date de naissance)(?![\p{L}\p{N}_])/giu;
const months =
  'January February March April May June July August September October November December Jan Feb Mar Apr Jun Jul Aug Sep Sept Oct Nov Dec января февраля марта апреля мая июня июля августа сентября октября ноября декабря январь февраль март апрель май июнь июль август сентябрь октябрь ноябрь декабрь'
    .split(' ')
    .join('|');
const dates = new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:\\d{4}-\\d{1,2}-\\d{1,2}|\\d{1,2}[/.]\\d{1,2}[/.]\\d{4}|\\d{1,2}[ \\t]+(?:${months})[ \\t]+\\d{4}|(?:${months})[ \\t]+\\d{1,2},?[ \\t]+\\d{4})(?![\\p{L}\\p{N}_])`,
  'giu'
);
const phoneContext =
  /(?<![\p{L}\p{N}_])(?:WhatsApp|Zalo|Viber|Telegram|Signal|WeChat|LINE|KakaoTalk|звоните|пишите|звонить|номер телефона|телефон|phone|call)(?![\p{L}\p{N}_])/iu;
const nationalPhone =
  /(?<![\p{L}\p{N}_+])(?:8[ ()-]{0,3}9\d{2}[ )-]{0,3}\d{3}[ -]{0,2}\d{2}[ -]{0,2}\d{2}|\(?0[ ()-]{0,2}[35789]\d[ )-]{0,3}\d{3}[ -]{0,2}\d{4}|\(?0[ ()-]{0,2}\d[ )-]{0,3}\d{3}[ -]{0,2}\d{4}|\(?0[ ()-]{0,2}8\d{2}[ )-]{0,3}\d{4}[ -]{0,2}\d{4})(?![\p{L}\p{N}_])/gu;
export function detectPersonalContext(text, emit) {
  for (const label of text.matchAll(birth)) {
    const start = label.index + label[0].length;
    const window = text.slice(start, start + 80).split(/[\r\n|;]/)[0];
    const match = new RegExp(dates.source, dates.flags).exec(window);
    if (match) {
      emit({
        start: start + match.index,
        end: start + match.index + match[0].length,
        type: 'DATE_OF_BIRTH',
        category: 'personal',
        rule: 'birth-context',
        confidence: 0.9,
      });
    }
  }
  collectMatches(
    text,
    nationalPhone,
    emit,
    {
      type: 'PHONE',
      category: 'personal',
      rule: 'phone-context',
      confidence: 0.9,
    },
    0,
    (value, match) => {
      const prefix = text
        .slice(Math.max(0, match.index - 80), match.index)
        .split(/[\r\n|;]/)
        .at(-1);
      return (
        phoneContext.test(prefix) &&
        !/\d[ ()-]*$/.test(prefix) &&
        !/^[ ()-]*\d/.test(
          text.slice(match.index + value.length, match.index + value.length + 4)
        )
      );
    }
  );
}
