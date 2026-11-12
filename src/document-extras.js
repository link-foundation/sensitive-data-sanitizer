import { collectMatches } from './detection.js';
import {
  detectDatedEmployers,
  isDocumentTechnology,
} from './document-experience.js';
import { isDocumentShareLink } from './proper-names.js';
import { flatRegExp } from './unicode-runs.js';
// A value-shaped e-mail; the loops stay flat on long values (#172).
const emailValue = flatRegExp(/^[^\s@]+@[^\s@]+\.[\p{L}]{2,63}$/u);

const boundary = '[\\p{L}\\p{N}_]';
const proper = '[\\p{Lu}][\\p{L}\\p{M}\\p{N}.-]{0,46}[\\p{L}\\p{M}\\p{N}]';
const name = `${proper}(?:[ \\t]+${proper}){0,5}`;
const employerName = `(?:«[^«»\\r\\n]{1,160}»|“[^“”\\r\\n]{1,160}”|"[^"\\r\\n]{1,160}"|${name})`;
const orgList = `(?:«[^«»\\r\\n]{1,160}»|${name})(?:[ \\t]*(?:,|и|and)[ \\t]+${name}){0,5}`;
const cues = new RegExp(
  `(?<!${boundary})(?:компании|опыт[ \\t]+в|проекты[ \\t]+для|[Рр]оль[ \\t]+в)[ \\t]+(${orgList})(?!${boundary})`,
  'gu'
);
const duration = new RegExp(
  `(?<!${boundary})(${name})(?=[ \\t]*\\(\\d{1,2}[ \\t]+(?:год|года|лет|years?)\\))`,
  'gu'
);
export function detectDocumentExtras(text, emit, range, debug, options) {
  for (const [type, rule, pattern, group] of [
    ['PHONE', 'document-mobile-bare', /^[78]9\d{9}$/gm, 0],
    [
      'PHONE',
      'document-mobile-comma',
      /,[ \t]*([78]9\d{9})(?![\p{L}\p{N}_])/gu,
      1,
    ],
    [
      'ORGANIZATION',
      'organization-group-cue',
      new RegExp(
        `(?<!${boundary})(?:ГК|[Гг]руппа компаний)[ \\t]+${employerName}`,
        'gu'
      ),
      0,
    ],
    [
      'EDUCATION',
      'education-bracket',
      /(?<=\()(МГУ|СПбГУ|МГТУ|РГГУ|ВШЭ)(?=[,)])/gu,
      1,
    ],
    [
      'EDUCATION',
      'education-named-acronym',
      /(?<![\p{L}\p{N}_])(?:МГУ|СПбГУ|МГТУ|РГГУ|ВШЭ)[ \t]+им\.[ \t]+[А-ЯЁ][а-яё-]{2,40}/gu,
      0,
    ],
    [
      'EDUCATION',
      'education-training',
      /(?<![\p{L}\p{N}_])(?:Обучение|Training)[ \t]*:[ \t]*([\p{Lu}][\p{L}\p{M}.-]{1,47})/gu,
      1,
    ],
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
      flatRegExp(
        /(?<![\p{L}\p{N}_])(?:https?:\/\/[^\s/"<>]+)?\/(?:u|in|users?|profiles?|people|members?|home)\/[^\s?&#"<>\\]{1,128}/giu
      ),
      0,
    ],
    [
      'URL',
      'document-share-link',
      flatRegExp(
        /https?:\/\/[^\s/"<>]+\/(?:[^\s/?#"<>]{1,64}\/){0,5}[A-Za-z0-9_-]{24,128}(?:\/[^\s?&#"<>\\]{0,64})?/gu
      ),
      0,
    ],
  ]) {
    collectMatches(
      text,
      pattern,
      emit,
      { type, rule, category: 'personal', confidence: 0.85 },
      group,
      (value) => type !== 'ORGANIZATION' || !isDocumentTechnology(value)
    );
  }
  for (const match of text.matchAll(cues)) {
    const offset = match.index + match[0].lastIndexOf(match[1]);
    for (const company of match[1].matchAll(
      new RegExp(`«[^«»\\r\\n]{1,160}»|${name}`, 'gu')
    )) {
      if (isDocumentTechnology(company[0])) {
        continue;
      }
      emit({
        start: offset + company.index,
        end: offset + company.index + company[0].length,
        type: 'ORGANIZATION',
        category: 'personal',
        rule: 'organization-cue',
        confidence: 0.85,
      });
    }
  }
  detectQueryContacts(text, emit);
  collectMatches(
    text,
    flatRegExp(/https?:\/\/[^\s"<>\\]+/gu),
    emit,
    {
      type: 'URL',
      category: 'personal',
      rule: 'document-share-path',
      confidence: 0.85,
    },
    0,
    isDocumentShareLink
  );
  detectEmployerContinuation(text, emit);
  detectDatedEmployers(text, emit, range, debug, options);
}

function detectEmployerContinuation(text, emit) {
  const continuation = new RegExp(
    `,[ \\t]*(?:потом|затем)[ \\t]+в[ \\t]+(${employerName})`,
    'uy'
  );
  for (const match of text.matchAll(
    new RegExp(
      `(?<!${boundary})[Рр]аботал[аи]?[ \\t]+в[ \\t]+(${employerName})`,
      'gu'
    )
  )) {
    continuation.lastIndex = match.index + match[0].length;
    let next = continuation.exec(text);
    if (next) {
      emitEmployer(match);
    }
    while (next) {
      emitEmployer(next);
      next = continuation.exec(text);
    }
  }
  function emitEmployer(match) {
    const end = match.index + match[0].length;
    if (!isDocumentTechnology(match[1])) {
      emit({
        start: end - match[1].length,
        end,
        type: 'ORGANIZATION',
        category: 'personal',
        rule: 'organization-continuation',
        confidence: 0.85,
      });
    }
  }
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
    if (!(email ? emailValue : /^\+?[\d () .-]{7,40}$/).test(value)) {
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
