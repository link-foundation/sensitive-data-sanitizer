import { fakeIdentityValue } from './identity.js';

export function fakeDocumentSpans(text, options) {
  if (options.fakeIdentity !== 'specimen-and-synthetic') {
    return [];
  }
  const spans = [];
  // Group adjacent name/data lines using the document-number field as evidence.
  // A specimen header beside a real document must never exempt the latter.
  const documents =
    /([PVIA][A-Z<]([A-Z<]{3})[A-Z<]{8,44})(?:\r?\n|\\n|[ \t]+)([A-Z0-9<]{9}[\d<]([A-Z<]{3})[\d<]{6}[\d<][MF<][A-Z0-9<]{7,25})/g;
  for (const match of text.matchAll(documents)) {
    if (fakeIdentityValue(match[3], 'PASSPORT_MRZ', options)) {
      spans.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  const td1 =
    /[IAC][A-Z<][A-Z<]{3}[A-Z0-9<]{9}[\d<][A-Z0-9<]{15}(?:\r?\n|\\n|[ \t]+)[\d<]{6}[\d<][MF<][\d<]{6}[\d<][A-Z<]{3}[A-Z0-9<]{12}(?:\r?\n|\\n|[ \t]+)[A-Z]+<<[A-Z<]{2,27}/g;
  for (const match of text.matchAll(td1)) {
    if (fakeIdentityValue(match[0].slice(0, 30), 'PASSPORT_MRZ', options)) {
      spans.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  // Published German specimen fields are a bounded fragment, not an
  // exemption for other identities elsewhere on the same log record.
  for (const match of text.matchAll(
    /(?:(?:MUSTERMANN|ERIKA|SPECIMEN|ОБРАЗЕЦ|REISEPASS)[ \t]+){0,5}(?:C01X00T47|T22000129)(?:[ \t]+(?:MUSTERMANN|ERIKA|SPECIMEN|ОБРАЗЕЦ)){0,5}/gi
  )) {
    if (/(?:SPECIMEN|MUSTERMANN|ОБРАЗЕЦ)/i.test(match[0])) {
      spans.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return spans;
}
