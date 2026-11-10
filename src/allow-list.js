import { failure } from './detection.js';

// Caller-declared values are explicit private policy; an allow list must not
// silently cancel them. Schema denials (JSON_VALUE) always win as well.
const declaredRules = new Set([
  'known-personal',
  'confirmed-personal',
  'known-secret',
]);
const anchored = new WeakMap();

function fullMatcher(pattern) {
  let compiled = anchored.get(pattern);
  if (!compiled) {
    compiled = new RegExp(
      `^(?:${pattern.source})$`,
      pattern.flags.replace(/[gy]/g, '')
    );
    anchored.set(pattern, compiled);
  }
  return compiled;
}

export function validateAllowList(options) {
  const list = options.allowList;
  if (list === undefined) {
    return;
  }
  if (
    !Array.isArray(list) ||
    list.length > 10000 ||
    !list.every(
      (entry) =>
        (typeof entry === 'string' && entry.length > 0) ||
        entry instanceof RegExp
    )
  ) {
    throw failure('ERR_CONFIG');
  }
}

// Presidio allow_list, Google exclusion rules (MATCHING_TYPE_FULL_MATCH) and
// DataFog allowlist_patterns: a listed string or pattern must cover the whole
// detected value. Partial matches never shorten a finding.
export function allowListed(text, finding, options) {
  if (
    !options.allowList?.length ||
    declaredRules.has(finding.rule) ||
    finding.type === 'JSON_VALUE' ||
    (finding.category === 'credential' && !options.allowCredentialDisable)
  ) {
    return false;
  }
  const value = text.slice(finding.start, finding.end);
  return options.allowList.some((entry) =>
    typeof entry === 'string' ? entry === value : fullMatcher(entry).test(value)
  );
}
