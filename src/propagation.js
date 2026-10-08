import { escapePattern, failure } from './detection.js';
import { actionable } from './confidence.js';

// Only confirmed values seed propagation. A low-score numeric coincidence
// must never turn every log occurrence into a high-score identity.
function confirmedSeeds(text, findings, options) {
  const seeds = new Map();
  for (const finding of findings) {
    if (finding.category !== 'personal' || !actionable(finding, options)) {
      continue;
    }
    if (
      ![
        'PERSON',
        'PASSPORT_NUMBER',
        'BOOKING_REFERENCE',
        'VISA_NUMBER',
        'TICKET_NUMBER',
        'PASSPORT_MRZ',
      ].includes(finding.type)
    ) {
      continue;
    }
    const value = text.slice(finding.start, finding.end);
    if (finding.type === 'PASSPORT_MRZ') {
      for (const match of value.matchAll(
        /(?:[PIACV][A-Z<][A-Z<]{3})?([A-Z]{2,30})<<([A-Z]+(?:<[A-Z]+)*)/g
      )) {
        const surname =
          match.index > 0 && /[PIACV][A-Z<]$/.test(value.slice(0, match.index))
            ? match[1].slice(3)
            : match[1];
        for (const name of [surname, ...match[2].split('<')]) {
          seeds.set(name, { ...finding, type: 'PERSON' });
        }
      }
      const number = /(?:^|[\r\n])([A-Z0-9]{9})[\d<][A-Z<]{3}\d{6}/.exec(value);
      if (number) {
        seeds.set(number[1], { ...finding, type: 'PASSPORT_NUMBER' });
      }
    } else if (value.length >= 4) {
      seeds.set(value, finding);
      if (finding.type === 'PERSON') {
        for (const name of value.match(/\p{L}{2,}/gu) ?? []) {
          seeds.set(name, finding);
        }
      }
    }
  }
  return seeds;
}
export function propagate(text, findings, options) {
  const result = [...findings];
  const seen = new Set(findings.map((f) => `${f.start}:${f.end}:${f.type}`));
  for (const [value, seed] of confirmedSeeds(text, findings, options)) {
    const pattern = new RegExp(
      escapePattern(value).replace(/[ _-]+/g, '[ \\t_-]+'),
      'giu'
    );
    for (const match of text.matchAll(pattern)) {
      if (
        /[\p{L}\p{N}]/u.test(text[match.index - 1] ?? '') ||
        /[\p{L}\p{N}]/u.test(text[match.index + match[0].length] ?? '')
      ) {
        continue;
      }
      // A confirmed full name already protects its components at this location.
      // Keep that span intact for public-name verification and transformations.
      if (
        findings.some(
          (f) =>
            f.type === seed.type &&
            f.start <= match.index &&
            f.end >= match.index + match[0].length
        )
      ) {
        continue;
      }
      const id = `${match.index}:${match.index + match[0].length}:${seed.type}`;
      if (!seen.has(id)) {
        seen.add(id);
        result.push({
          ...seed,
          start: match.index,
          end: match.index + match[0].length,
          rule: 'document-propagation',
        });
        if (result.length > (options.maxFindings ?? 100000)) {
          throw failure('ERR_LIMIT');
        }
      }
    }
  }
  return result;
}
