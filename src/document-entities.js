import { collectMatches, escapePattern } from './detection.js';
import { documentVocabulary } from './document-vocabulary.js';

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
const quoted = `(?:[«“「『"]${name}[»”」』"]|${name})`;
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

export function detectDocumentEntities(text, emit, options) {
  if (!options.documentEntities) {
    return;
  }
  for (const [type, rule, pattern, group, confidence] of [
    ['ORGANIZATION', 'organization-legal-form', organizations, 0, 0.7],
    ['EDUCATION', 'education-type', schools, 0, 0.65],
    ['LOCATION', 'location-gazetteer', places, 0, 0.6],
    ['LOCATION', 'location-label', labelledPlace, 1, 0.75],
  ]) {
    collectMatches(
      text,
      pattern,
      emit,
      { type, rule, category: 'personal', confidence },
      group
    );
  }
}
