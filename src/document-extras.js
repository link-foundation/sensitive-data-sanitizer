import { collectMatches } from './detection.js';

const boundary = '[\\p{L}\\p{N}_]';
const proper = '[\\p{Lu}][\\p{L}\\p{M}.-]{1,47}';
const name = `${proper}(?:[ \\t]+${proper}){0,5}`;
const orgList = `(?:«[^«»\\r\\n]{1,160}»|${name})(?:[ \\t]*(?:,|и|and)[ \\t]+${name}){0,5}`;
const cues = new RegExp(
  `(?<!${boundary})(?:компании|опыт[ \\t]+в|проекты[ \\t]+для|[Рр]оль[ \\t]+в)[ \\t]+(${orgList})(?!${boundary})`,
  'gu'
);
const duration = new RegExp(
  `(?<!${boundary})(${name})(?=[ \\t]*\\(\\d{1,2}[ \\t]+(?:год|года|лет|years?)\\))`,
  'gu'
);
// JavaScript's \b is ASCII-only; Cyrillic titles use a Unicode lookahead.
const role =
  /^(?:менеджер|директор|руководитель|инженер|аналитик|разработчик)(?![\p{L}])|^(?:manager|director|engineer|developer|senior|qa)\b/iu;

export function detectDocumentExtras(text, emit, range) {
  for (const [type, rule, pattern, group] of [
    ['PHONE', 'document-mobile-bare', /^[78]9\d{9}$/gm, 0],
    [
      'PHONE',
      'document-mobile-context',
      /(?<![\p{L}\p{N}_])(?:пишите|контакт)[:,]?[ \t]+([78]9\d{9})(?!\d)/giu,
      1,
    ],
    [
      'ORGANIZATION',
      'organization-experience-prose',
      new RegExp(`опыт[ \\t]*\\((${name})\\)`, 'gu'),
      1,
    ],
    ['ORGANIZATION', 'organization-cue', cues, 1],
    ['ORGANIZATION', 'organization-duration', duration, 1],
    [
      'PERSON',
      'document-role',
      /(?<![\p{L}\p{N}_])(?:Соискатель|Сотрудник)[ \t]*:[ \t]*([\p{Lu}][\p{L}-]{1,47}(?:[ \t]+[\p{Lu}][\p{L}-]{1,47}){0,4})/gu,
      1,
    ],
    [
      'URL',
      'document-personal-path',
      /(?<![\p{L}\p{N}_])(?:https?:\/\/[^\s/"<>]+)?\/(?:u|in|users?|profiles?|people|members?|home)\/[^\s?&#"<>\\]{1,128}/giu,
      0,
    ],
    [
      'URL',
      'document-share-link',
      /https?:\/\/[^\s/"<>]+\/(?:[^\s/?#"<>]{1,64}\/){0,5}[A-Za-z0-9_-]{24,128}(?:\/[^\s?&#"<>\\]{0,64})?/gu,
      0,
    ],
  ]) {
    collectMatches(
      text,
      pattern,
      emit,
      { type, rule, category: 'personal', confidence: 0.85 },
      group
    );
  }
  detectQueryContacts(text, emit);
  detectExperience(text, emit, range);
}

function detectQueryContacts(text, emit) {
  // Retain query context while decoding; standalone contacts may be public specimens.
  for (const match of text.matchAll(
    /[?&](email|phone)=([^\s&#"<>\\]{1,512})/giu
  )) {
    let value;
    try {
      value = decodeURIComponent(match[2]);
    } catch {
      continue;
    }
    const email = match[1].toLowerCase() === 'email';
    if (
      !(
        email ? /^[^\s@]+@[^\s@]+\.[\p{L}]{2,63}$/u : /^\+?[\d () .-]{7,40}$/
      ).test(value)
    ) {
      continue;
    }
    if (value === '[REDACTED]') {
      continue;
    }
    const start = match.index + match[0].length - match[2].length;
    emit({
      start,
      end: start + match[2].length,
      type: email ? 'EMAIL' : 'PHONE',
      category: 'personal',
      rule: 'label',
      confidence: 0.95,
    });
  }
}

function detectExperience(text, emit, range) {
  // Date anchors bound each entry; do not guess at undated employer/title fragments.
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
    1
  );
  const dated = new RegExp(`([^\\r\\n;|]{1,320}?)\\((${range})\\)`, 'gu');
  for (const match of text.matchAll(dated)) {
    const prefix = match[1];
    const content = prefix
      .replace(/^.*\(\d[^)]*\)[, \t]*/, '')
      .replace(/^[, \t]+/, '');
    const parts = content.split(/,[ \t]*/);
    let value;
    if (parts.length > 1 && role.test(parts[0])) {
      let index = 1;
      while (index < parts.length - 1 && /^[\p{Ll}]/u.test(parts[index])) {
        index++;
      }
      value = parts.slice(index).join(', ').trim();
    } else if (parts.length === 2 && role.test(parts[1])) {
      value = parts[0].trim();
    }
    if (
      !value ||
      !/^[\p{Lu}«“"]/u.test(value) ||
      value.includes('[REDACTED]')
    ) {
      continue;
    }
    const start = match.index + prefix.lastIndexOf(value);
    if (start < match.index) {
      continue;
    }
    emit({
      start,
      end: start + value.length,
      type: 'ORGANIZATION',
      category: 'personal',
      rule: 'organization-experience',
      confidence: 0.85,
    });
  }
}
