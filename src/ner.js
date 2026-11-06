// Optional entry: no core module imports NLP.js or this recognizer.
import { firstNames } from './names.js';
import { documentVocabulary } from './document-vocabulary.js';

const boundary = '[\\p{L}\\p{M}\\p{N}_]';
const proper = "\\p{Lu}[\\p{L}\\p{M}’'-]{1,47}";
const name = `${proper}(?:[ \\t]+${proper}){0,3}`;
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blocked =
  /^(?:Kubernetes|PostgreSQL|Python|JavaScript|TypeScript|Node|Docker|Redis|Linux|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|REDACTED)$/iu;
const configError = () =>
  Object.assign(new Error('Invalid offline recognizer configuration.'), {
    code: 'ERR_CONFIG',
  });

function rulesFor(language) {
  const names = firstNames[language]
    .split(' ')
    .filter((s) => !/^(?:May|Will|Mark|Rose)$/u.test(s));
  const places = documentVocabulary
    .filter((row) => row[0] === language)
    .flatMap((row) => row[3].split('|'));
  const rules = [
    ['PERSON', `(?:${names.map(escape).join('|')})(?:[ \\t]+${proper})?`],
    ['LOCATION', `(?:${places.map(escape).join('|') || '(?!)'})`],
  ];
  if (language === 'ru') {
    rules.push(
      ['ORGANIZATION', `(?<=(?:[Рр]аботал[аи]?|[Сс]лужил[аи]?) в )${name}`],
      [
        'ORGANIZATION',
        `${name}(?=:[ \\t]*(?:менеджер|директор|разработчик|инженер|аналитик|маркетолог)(?!\\p{L}))`,
      ],
      ['EDUCATION', '(?:МГУ|СПбГУ|МГТУ|РГГУ|ВШЭ|МФТИ|ИТМО)'],
      ['EDUCATION', `${name}[ \\t]+(?:университет|институт|академия)`],
      ['LOCATION', `(?<=(?:[Жж]иву|[Пп]роживаю) в )${name}`]
    );
  } else {
    rules.push(
      ['ORGANIZATION', `(?<=(?:[Aa]t|[Jj]oined|[Ee]mployer:) )${name}`],
      ['EDUCATION', `(?<=(?:[Gg]raduated from|[Ss]tudied at) )${name}`],
      [
        'EDUCATION',
        '(?:MIT|MSU|UCLA|UCL|NYU|Harvard|Stanford|Oxford|Cambridge)',
      ],
      ['EDUCATION', `${name}[ \\t]+(?:University|College|Institute)`],
      ['LOCATION', `(?<=(?:[Ll]ive in|[Ll]ocated in|[Bb]ased in) )${name}`]
    );
  }
  return rules.map(([type, source]) => ({
    name: type,
    type: 'regex',
    rules: [new RegExp(`(?<!${boundary})(?:${source})(?!${boundary})`, 'gu')],
  }));
}

/** Prepare an offline recognizer with synchronous detection. */
export async function createNerDetector(options = {}) {
  const languages = options.languages ?? ['ru', 'en'];
  if (
    !Array.isArray(languages) ||
    !languages.length ||
    languages.length > 2 ||
    languages.some((s) => !['ru', 'en'].includes(s)) ||
    Object.keys(options).some((key) => !['languages', 'debug'].includes(key)) ||
    (options.debug !== undefined && typeof options.debug !== 'function')
  ) {
    throw configError();
  }
  const { ExtractorRegex } = await import('@nlpjs/ner');
  const extractor = new ExtractorRegex();
  const nerRules = [...new Set(languages)].flatMap(rulesFor);
  return Object.freeze({
    id: 'offline-ner',
    detect(text) {
      if (typeof text !== 'string' || text.length > 1024 * 1024) {
        throw Object.assign(new Error('Offline recognizer input limit.'), {
          code: 'ERR_LIMIT',
        });
      }
      const findings = extractor
        .extract({ text, nerRules })
        .edges.filter((edge) => !blocked.test(edge.sourceText))
        .map((edge) => ({
          start: edge.start,
          end: edge.end + 1,
          type: edge.entity,
          category: 'personal',
          rule: 'ner/offline',
          confidence: 0.8,
        }));
      options.debug?.({ event: 'offline-ner', count: findings.length });
      return findings;
    },
  });
}
