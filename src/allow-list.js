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

// Inline suppression comments understood by Gitleaks/Betterleaks
// (gitleaks:allow), detect-secrets and ripsecrets (pragma: allowlist secret),
// Kingfisher, TruffleHog and SonarQube. Honoured only with inlineAllow: true,
// because anyone who writes to a log could otherwise suppress redaction.
const sameLine =
  /(?:gitleaks|betterleaks|kingfisher|trufflehog|sanitizer):(?:allow|ignore)\b|pragma:\s*allowlist(?:\s+secret)?\b(?!\s+nextline)|\bNOSONAR\b/i;
const nextLine = /pragma:\s*allowlist\s+nextline(?:\s+secret)?\b/i;

function lineAt(text, index) {
  const start = text.lastIndexOf('\n', index - 1) + 1;
  const end = text.indexOf('\n', index);
  return { start, end: end < 0 ? text.length : end };
}

function inlineSuppressed(text, finding) {
  const line = lineAt(text, finding.start);
  if (sameLine.test(text.slice(line.start, line.end))) {
    return true;
  }
  if (line.start === 0) {
    return false;
  }
  const previous = lineAt(text, line.start - 1);
  return nextLine.test(text.slice(previous.start, previous.end));
}

export function validateAllowList(options) {
  if (
    options.inlineAllow !== undefined &&
    typeof options.inlineAllow !== 'boolean'
  ) {
    throw failure('ERR_CONFIG');
  }
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
    !(options.allowList?.length || options.inlineAllow) ||
    declaredRules.has(finding.rule) ||
    finding.type === 'JSON_VALUE' ||
    (finding.category === 'credential' && !options.allowCredentialDisable)
  ) {
    return false;
  }
  if (options.inlineAllow && inlineSuppressed(text, finding)) {
    return true;
  }
  const value = text.slice(finding.start, finding.end);
  return (options.allowList ?? []).some((entry) =>
    typeof entry === 'string' ? entry === value : fullMatcher(entry).test(value)
  );
}
