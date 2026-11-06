import { compiledVocabulary } from './vocabulary.js';

const technology = new Set(
  [
    'Python',
    'Go',
    'SQL',
    'Excel',
    'Power BI',
    'Kubernetes',
    'PostgreSQL',
    'Telegram',
    'Scrum',
  ].map((s) => s.toLowerCase())
);
export const isDocumentTechnology = (value) =>
  technology.has(value.trim().toLowerCase());

// Used only to disambiguate the reversed `Company, manager` layout. Forward
// entries deliberately accept any title, without a title vocabulary.
const reversedRole =
  /^(?:менеджер|директор|руководитель|инженер|аналитик|разработчик|manager|director|engineer|developer|senior|qa)(?!\p{L})/iu;

function commaParts(text) {
  const parts = [];
  let start = 0,
    depth = 0,
    quote;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quote) {
      if (char === quote) {
        quote = undefined;
      }
    } else if ('«“"'.includes(char)) {
      quote = { '«': '»', '“': '”', '"': '"' }[char];
    } else if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth = Math.max(0, depth - 1);
    } else if (char === ',' && !depth) {
      parts.push({ start, text: text.slice(start, i).trim() });
      start = i + 1;
    }
  }
  parts.push({ start, text: text.slice(start).trim() });
  return parts;
}

function employerSpan(prefix, roles) {
  // An industry suffix belongs to the entry, but is not an employer. A pipe
  // before the title remains a section separator, as in `Опыт | Менеджер, ...`.
  const comma = prefix.indexOf(',');
  const pipe = comma < 0 ? -1 : prefix.indexOf('|', comma);
  const content = pipe < 0 ? prefix : prefix.slice(0, pipe);
  const parts = commaParts(content);
  let index = 1;
  if (parts.length === 1) {
    return undefined;
  }
  if (/^[=\s\d]/u.test(parts[0].text)) {
    index++;
  }
  if (parts.length === 2 && roles.test(parts[1].text)) {
    index = 0;
  } else {
    while (index < parts.length - 1 && /^\p{Ll}/u.test(parts[index].text)) {
      index++;
    }
  }
  const part = parts[index];
  if (!part || !/^(?:[\p{Lu}«“"]|\d{1,4}-?\p{L})/u.test(part.text)) {
    return undefined;
  }
  const end = index === 0 ? content.indexOf(',') : content.trimEnd().length;
  const start = part.start + content.slice(part.start).search(/\S/u);
  return isDocumentTechnology(content.slice(start, end))
    ? undefined
    : { start, end };
}

export function detectDatedEmployers(text, emit, range, debug, options = {}) {
  let cursor = 0,
    count = 0;
  // Match only the anchor, then visit each preceding segment once. No lazy
  // prefix search restarts at every position on a long nonmatching line.
  for (const match of text.matchAll(new RegExp(`\\(${range}\\)`, 'gu'))) {
    const segment = text.slice(cursor, match.index);
    const boundary =
      Math.max(
        segment.lastIndexOf('\n'),
        segment.lastIndexOf('\r'),
        segment.lastIndexOf(';')
      ) + 1;
    const prefix = segment.slice(boundary).replace(/^[., \t]+/u, '');
    const span = employerSpan(
      prefix,
      compiledVocabulary(options.vocabulary)?.roles ?? reversedRole
    );
    if (span) {
      const offset = match.index - prefix.length;
      emit({
        start: offset + span.start,
        end: offset + span.end,
        type: 'ORGANIZATION',
        category: 'personal',
        rule: 'organization-experience',
        confidence: 0.85,
      });
      count++;
    }
    cursor = match.index + match[0].length;
  }
  debug?.({ event: 'document-experience', count });
}
