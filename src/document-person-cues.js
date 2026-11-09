import { collectMatches } from './detection.js';

// A cue supplies evidence for a single Latin name without activating broad
// capitalized-word matching for the rest of an English log or document.
const boundary = '[\\p{L}\\p{M}\\p{N}_]';
const name = "[A-Z][a-z]{1,47}(?:['’-][A-Z]?[a-z]{1,47})?";
const cue =
  '(?:[Cc]andidate|[Rr]ecruiter|[Aa]pplicant|[Dd]ear|[Hh]i|[Mm]r\\.?|[Mm]s\\.?|[Dd]r\\.?|[Mm]essage[ \\t]+from)';
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

export function detectDocumentPersonCues(text, emit) {
  collectMatches(
    text,
    pattern,
    emit,
    {
      type: 'PERSON',
      rule: 'document-person-cue',
      category: 'personal',
      confidence: 0.85,
    },
    1,
    (value) => !labels.has(value.toLowerCase())
  );
}
