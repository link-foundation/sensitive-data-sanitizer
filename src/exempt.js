import { failure } from './detection.js';

// `exempt(finding, text) => boolean` keeps findings the caller's policy
// knows are not sensitive (a configuration flag, a counter, a value another
// tool already masked). It runs after detection and before transformation.
// The hook decides per span: verification of the published text consults it
// again for each finding in the output, so the same value in another place
// is still caught unless the hook keeps that span too.
// Values the caller declared (`knownSecrets`, `knownPersonal`,
// `confirmedPersonal`) and structured `JSON_VALUE` denials are never offered.
const declared = new Set([
  'known-secret',
  'known-personal',
  'confirmed-personal',
]);
const offered = (finding) =>
  !declared.has(finding.rule) && finding.type !== 'JSON_VALUE';

// Only bounded escaped JSON views qualify for an independent policy check.
// Keep the decoder's 8192-character bound and cap recursive checks at three;
// malformed, oversized and other encoded findings retain normal handling.
export function escapedExemptionView(text, finding, depth) {
  if (
    depth >= 3 ||
    finding.type !== 'ENCODED_SENSITIVE' ||
    !['encoded', 'encoded-engine'].includes(finding.rule) ||
    finding.end - finding.start > 8192
  ) {
    return undefined;
  }
  const raw = text.slice(finding.start, finding.end);
  if (!raw.includes('\\')) {
    return undefined;
  }
  try {
    const decoded = JSON.parse(`"${raw}"`);
    return decoded !== raw ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function view(text, finding) {
  return Object.freeze({
    ...finding,
    value: text.slice(finding.start, finding.end),
  });
}

export function validateExempt(exempt) {
  if (exempt !== undefined && typeof exempt !== 'function') {
    throw failure('ERR_CONFIG');
  }
}

function decision(kept) {
  if (typeof kept !== 'boolean') {
    // `undefined` from a forgotten return must not silently keep a secret.
    throw failure('ERR_CONFIG');
  }
  return kept;
}

export function exemptFindings(text, findings, exempt) {
  if (!exempt) {
    return findings;
  }
  return findings.filter((finding) => {
    if (!offered(finding)) {
      return true;
    }
    const kept = exempt(view(text, finding), text);
    if (typeof kept?.then === 'function') {
      // An async hook needs the async engine (`createSanitizer`).
      kept.then(undefined, () => {});
      throw failure('ERR_CONFIG');
    }
    return !decision(kept);
  });
}

export async function exemptFindingsAsync(text, findings, exempt) {
  if (!exempt) {
    return findings;
  }
  const retained = [];
  for (const finding of findings) {
    if (
      !offered(finding) ||
      !decision(await exempt(view(text, finding), text))
    ) {
      retained.push(finding);
    }
  }
  return retained;
}
