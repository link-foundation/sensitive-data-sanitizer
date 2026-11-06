import { sanitize } from '../src/index.js';

// Synthetic mixed records: only the prose string activates the extra rule.
const source = JSON.stringify({
  note: 'Работал в Ромашке менеджером по продажам.',
  operational: 'Connection to Postgres lost, retrying',
  count: 42,
});
console.log(
  sanitize(source, {
    profile: 'documents',
    properNames: 'capitalized',
    scripts: ['Cyrillic'],
    structured: 'json',
  }).text
);
