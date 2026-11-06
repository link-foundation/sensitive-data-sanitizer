import { sanitize, createSanitizer, compileKnown } from '../../src/index.js';
const detector = {
  detect(t) {
    const i = t.indexOf('Ромашка');
    return i < 0
      ? []
      : [
          {
            start: i,
            end: i + 7,
            type: 'ORGANIZATION',
            rule: 'x',
            category: 'personal',
            confidence: 1,
          },
        ];
  },
};
for (const options of [
  { detectors: [detector] },
  { structured: 'json', allowedFields: ['msg'] },
  { structured: 'json', sensitiveFields: ['items.*.name'] },
  { structured: 'json', fields: { location: 'scan' } },
  { transformation: () => 'Z' },
  {
    knownPersonal: compileKnown([
      { type: 'URL', value: 'https://example.org/anna' },
    ]),
    knownOnly: true,
  },
  {
    vocabulary: {
      organizationCues: ['стартап'],
      personalFields: ['contactPerson'],
    },
  },
]) {
  for (const text of [
    'Ромашка тут',
    '{"msg":"ok","note":"Romashka","items":[{"name":"Value","count":10}],"location":"apps/api","contactPerson":"Neutral"}',
    'Анна Смирнова',
    'example.org/anna/?x=1',
    'стартап Ромашка',
  ]) {
    try {
      console.log(
        JSON.stringify({
          options: JSON.stringify(options),
          text,
          sync: sanitize(text, { profile: 'documents', ...options }).text,
          async: (
            await createSanitizer({
              profile: 'documents',
              secretlint: false,
              ...options,
            }).sanitize(text)
          ).text,
        })
      );
    } catch (e) {
      console.log(
        JSON.stringify({
          options: JSON.stringify(options),
          text,
          error: e.code,
        })
      );
    }
  }
}
