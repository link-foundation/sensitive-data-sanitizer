import { RE2 } from 're2-wasm';
import { RE2JS } from 're2js';
import { performance } from 'node:perf_hooks';
import r0 from './vendor/gitleaks/rules-0.json' with { type: 'json' };
import r1 from './vendor/gitleaks/rules-1.json' with { type: 'json' };
import r2 from './vendor/gitleaks/rules-2.json' with { type: 'json' };
import r3 from './vendor/gitleaks/rules-3.json' with { type: 'json' };
import r4 from './vendor/gitleaks/rules-4.json' with { type: 'json' };
import r5 from './vendor/gitleaks/rules-5.json' with { type: 'json' };
import b0 from './vendor/betterleaks/rules-0.json' with { type: 'json' };
import b1 from './vendor/betterleaks/rules-1.json' with { type: 'json' };
import b2 from './vendor/betterleaks/rules-2.json' with { type: 'json' };
import b3 from './vendor/betterleaks/rules-3.json' with { type: 'json' };
import b4 from './vendor/betterleaks/rules-4.json' with { type: 'json' };
import b5 from './vendor/betterleaks/rules-5.json' with { type: 'json' };
import { entropy, REDACTED } from './detection.js';
import { keywordMatcher } from './keywords.js';

export const gitleaksRules = [...r0, ...r1, ...r2, ...r3, ...r4, ...r5];
// Betterleaks rules whose ids are absent from the frozen Gitleaks set; see
// scripts/sync-betterleaks.py for the translated filter subset.
export const betterleaksRules = [...b0, ...b1, ...b2, ...b3, ...b4, ...b5];
const upstreamRules = [
  ...gitleaksRules.map((rule) => ({ rule, name: `gitleaks/${rule.id}` })),
  ...betterleaksRules.map((rule) => ({
    rule,
    name: `betterleaks/${rule.id}`,
  })),
];
const compiled = new Map();
const linearPatterns = new Map();
const keywordIndex = keywordMatcher(
  upstreamRules.flatMap(({ rule }) =>
    (rule.keywords ?? []).map((word) => word.toLowerCase())
  )
);
const confidence = { high: 0.95, medium: 0.85, low: 0.75 };

export function detectGitleaks(text, emit, trace) {
  const keywords = keywordIndex(text.toLowerCase());
  const large = Buffer.byteLength(text) > 4 * 1024 * 1024;
  for (const { rule, name } of upstreamRules) {
    if (
      !rule.regex ||
      (rule.keywords?.length &&
        !rule.keywords.some((word) => keywords.has(word.toLowerCase())))
    ) {
      continue;
    }
    const started = trace ? performance.now() : 0;
    for (const view of ruleViews(text, rule)) {
      scanRule(view.text, view.start, { rule, name }, emit, large);
    }
    trace?.({
      rule: name.startsWith('gitleaks/') ? rule.id : name,
      length: text.length,
      ms: performance.now() - started,
    });
  }
}

function* ruleViews(text, rule) {
  // These bounded rules require a listed keyword within 300 characters of
  // every match. Local views avoid RE2's expensive search/copy over unrelated
  // multi-megabyte image data. Keep the unbounded catalog rules intact.
  const boundedPrefix = {
    'authress-service-client-access-key': '\\b(?:sc|ext|scauth|authress)_',
    'atlassian-api-token': '(?:atlassian|confluence|jira)',
    'etsy-access-token': 'etsy',
    'new-relic-user-api-key': '(?:new-relic|newrelic|new_relic)',
    'okta-access-token': 'okta',
    'snyk-api-token': 'snyk[_.-]?(?:(?:api|oauth)[_.-]?)?(?:key|token)',
  }[rule.id];
  if (boundedPrefix) {
    yield* boundedViews(text, boundedPrefix, rule.id);
    return;
  }
  const targeted = {
    'generic-api-key':
      /(?:access|auth|api|credential|creds|key|passw(?:or)?d|secret|token)[ \t\w.-]{0,20}[\s'"]{0,3}(?:=|>|:{1,3}=|\|\||:|=>|\?=|,)/gi,
    'hashicorp-tf-password': /administrator_login_password|password/gi,
    'sonar-api-token': /sonar[_.-]?(?:login|token)/gi,
  }[rule.id];
  if (!targeted) {
    yield { text, start: 0 };
    return;
  }
  // These vendored rules have <=50 prefix characters and <=31 characters
  // between their required keyword and secret. Scan near each keyword instead
  // of recopying an entire session into WASM for every match. Extend the only
  // unbounded secret alternative to its real terminator; never truncate it.
  let coveredEnd = -1;
  for (const match of text.matchAll(targeted)) {
    // A keyword inside an already scanned value must not copy/rescan its
    // complete suffix. Base64 can contain thousands of incidental keywords.
    if (match.index + 384 <= coveredEnd || coveredEnd === text.length) {
      continue;
    }
    let start = Math.max(0, match.index - 50),
      end = Math.min(text.length, match.index + 384);
    if (/[\uDC00-\uDFFF]/.test(text[start] ?? '')) {
      start--;
    }
    while (end < text.length && /[\w.=/+-]/.test(text[end])) {
      end++;
    }
    end = Math.min(text.length, end + 3);
    coveredEnd = end;
    yield { text: text.slice(start, end), start };
  }
}

function* boundedViews(text, prefix, id) {
  const words = new RegExp(
    id === 'authress-service-client-access-key'
      ? prefix
      : `${prefix}[ \\t\\w.-]{0,20}[\\s'"]{0,3}(?:=|>|:{1,3}=|\\|\\||:|=>|\\?=|,)${id === 'atlassian-api-token' ? '|ATATT3' : ''}`,
    'gi'
  );
  let covered = -1;
  for (const match of text.matchAll(words)) {
    if (match.index + 512 <= covered) {
      continue;
    }
    let start = Math.max(0, match.index - 512);
    let end = Math.min(text.length, match.index + 1024);
    if (/[\uDC00-\uDFFF]/.test(text[start] ?? '')) {
      start--;
    }
    if (/[\uDC00-\uDFFF]/.test(text[end] ?? '')) {
      end++;
    }
    covered = end;
    yield { text: text.slice(start, end), start };
  }
}

function scanRule(text, base, { rule, name }, emit, large) {
  for (const match of ruleMatches(text, name, rule, large)) {
    const secret = capturedSecret(rule, match);
    if (!secret) {
      continue;
    }
    // RE2's wrapper exposes full-match offsets, not subgroup indices. If the
    // span includes each occurrence when a captured substring is repeated.
    const offset = match[0].indexOf(secret),
      last = match[0].lastIndexOf(secret);
    emit({
      start: base + match.index + offset,
      end: base + match.index + last + secret.length,
      type: 'SECRET',
      category: 'credential',
      rule: name,
      confidence: confidence[rule.confidence] ?? (rule.entropy ? 0.85 : 0.95),
    });
  }
}

function* ruleMatches(text, name, rule, large) {
  if (large) {
    // re2-wasm has a fixed 16 MiB heap. RE2JS implements the same linear-time
    // syntax without copying the input into WASM. Its indices are UTF-16.
    yield* linearMatches(text, name, rule.regex);
    return;
  }
  // re2-wasm 1.0.2 returns codepoint indices despite its RegExp-like API.
  // Normalize matches here so switching engines never changes public offsets.
  let offsets;
  if (/[\uD800-\uDBFF]/.test(text)) {
    offsets = [0];
    let offset = 0;
    for (const char of text) {
      offset += char.length;
      offsets.push(offset);
    }
  }
  let pattern = compiled.get(name);
  if (!pattern) {
    pattern = new RE2(rule.regex, 'gu');
    compiled.set(name, pattern);
  }
  pattern.lastIndex = 0;
  for (let attempts = 0; attempts < 8; attempts++) {
    const match = pattern.exec(text);
    if (!match) {
      return;
    }
    pattern.lastIndex = match.index + Math.max(1, Array.from(match[0]).length);
    match.index = offsets ? offsets[match.index] : match.index;
    yield match;
  }
  // Every exec recopies the whole view into WASM. Bound those copies even
  // for dense inputs, then replay at most eight matches in the JS engine.
  // Keep the original subject: slicing would change anchors and boundaries.
  const resume = offsets ? offsets[pattern.lastIndex] : pattern.lastIndex;
  if (resume !== undefined && resume <= text.length) {
    yield* linearMatches(text, name, rule.regex, resume);
  }
}

function linearPattern(key, source) {
  let linear = linearPatterns.get(key);
  if (!linear) {
    linear = RE2JS.compile(source);
    linearPatterns.set(key, linear);
  }
  return linear;
}

function* linearMatches(text, name, source, resume = 0) {
  const linear = linearPattern(name, source);
  if (linear.test(text)) {
    for (const match of linear.matchAll(text)) {
      if (match.index >= resume) {
        yield match;
      }
    }
  }
}

function capturedSecret(rule, match) {
  const secret = rule.secretGroup
    ? match[rule.secretGroup]
    : (match.slice(1).find(Boolean) ?? match[0]);
  return !secret || secret === REDACTED || filtered(rule, secret)
    ? undefined
    : secret;
}

// Secret-only Betterleaks filter clauses, translated by the sync script.
function filtered(rule, secret) {
  const score = rule.entropy ? entropy(secret) : Infinity;
  const test = (source) =>
    linearPattern(`filter:${source}`, source).test(secret);
  return (
    score < rule.entropy ||
    (rule.entropyInclusive && score === rule.entropy) ||
    (rule.reject ?? []).some(test) ||
    !(rule.require ?? []).every(test)
  );
}
