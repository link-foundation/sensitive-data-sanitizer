import { collectMatches } from './detection.js';

// A cue supplies evidence for a single Latin name without activating broad
// capitalized-word matching for the rest of an English log or document.
const boundary = '[\\p{L}\\p{M}\\p{N}_]';
const name = "[A-Z][a-z]{1,47}(?:['’-][A-Z]?[a-z]{1,47})?";
// Honorifics count only when capitalized: lowercase `ms` is the millisecond
// unit in logs and lowercase `dr` is usually a word or path fragment. A
// capitalized `Ms` right after a number is still a unit (`took 30 Ms Retry`).
const cue =
  '(?:[Cc]andidate|[Rr]ecruiter|[Aa]pplicant|[Dd]ear|[Hh]i|Mr\\.?|Ms(?<!\\d[ \\t]*Ms)\\.?|Dr\\.?|[Mm]essage[ \\t]+from)';
const pattern = new RegExp(
  `(?<!${boundary})${cue}[ \\t]+(${name})(?!${boundary})`,
  'gu'
);
// Workflow headings use the same person-role cues. Do not treat these finite
// generic nouns as names merely because a heading is in title case.
const labels = new Set(
  'stage status name profile details information summary experience application tracking interview selection pipeline request failed'.split(
    ' '
  )
);
const russianLabel =
  /(?<![\p{L}\p{M}\p{N}_])(?:имя|фио|фамилия|кандидат|соискатель)[ \t]*:[ \t]*/giu;
const labelledWord = "[\\p{L}\\p{M}]{1,48}(?:[-’'][\\p{L}\\p{M}]{1,48})?";
const labelledEnd = "(?![\\p{L}\\p{M}\\p{N}_@’'-]|[ \\t]*:)";
const labelledName = new RegExp(
  `${labelledWord}${labelledEnd}(?:[ \\t]+(?=\\p{Lu})${labelledWord}${labelledEnd}){0,2}`,
  'uy'
);

export function detectDocumentPersonCues(text, emit) {
  const details = {
    type: 'PERSON',
    rule: 'document-person-cue',
    category: 'personal',
    confidence: 0.85,
  };
  collectMatches(
    text,
    pattern,
    emit,
    details,
    1,
    (value) => !labels.has(value.toLowerCase())
  );
  for (const cue of text.matchAll(russianLabel)) {
    const start = cue.index + cue[0].length;
    if (
      /^(?:нет|не[ \t]+указан[оаы]?|unknown)(?![\p{L}\p{M}])/iu.test(
        text.slice(start, start + 32)
      )
    ) {
      continue;
    }
    labelledName.lastIndex = start;
    const match = labelledName.exec(text);
    if (match) {
      emit({ start, end: start + match[0].length, ...details });
    }
  }
}
