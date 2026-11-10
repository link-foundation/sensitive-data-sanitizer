// Sanitizes a CV note into readable placeholders, then sanitizes the result
// again after a model added text, keeping the tokens already in it.
import {
  createSyncSanitizer,
  isPlaceholderToken,
} from '@link-foundation/sensitive-data-sanitizer';

const policy = (existing) => ({
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  transformation: { mode: 'placeholder', map: false, existing },
});

const first = createSyncSanitizer(policy()).sanitize(
  'Кандидат Петров Иван Сергеевич, тел. +7 916 123-45-67. Работал в ООО «Ромашка», живу в Казани. Перенёс инсульт.'
).text;
console.log(first);
// Кандидат Person-1, тел. Phone-1. Работал в Organization-1, живу в Location-1. Перенёс PersonalAttribute-1.

const answer = `${first} Рекомендует Анна Смирнова.`;
const second = createSyncSanitizer(policy('keep')).sanitize(answer).text;
console.log(second);
// ... Перенёс PersonalAttribute-1. Рекомендует Person-2.

console.log(
  second.split(/[\s,.]+/u).filter((word) => isPlaceholderToken(word))
);
