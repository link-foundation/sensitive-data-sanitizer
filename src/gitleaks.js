import { RE2 } from 're2-wasm';
import { RE2JS } from 're2js';
import { performance } from 'node:perf_hooks';
import r0 from './vendor/gitleaks/rules-0.json' with { type: 'json' };
import r1 from './vendor/gitleaks/rules-1.json' with { type: 'json' };
import r2 from './vendor/gitleaks/rules-2.json' with { type: 'json' };
import r3 from './vendor/gitleaks/rules-3.json' with { type: 'json' };
import r4 from './vendor/gitleaks/rules-4.json' with { type: 'json' };
import r5 from './vendor/gitleaks/rules-5.json' with { type: 'json' };
import { entropy, REDACTED } from './detection.js';
import { keywordMatcher } from './keywords.js';

export const gitleaksRules = [...r0, ...r1, ...r2, ...r3, ...r4, ...r5];
const compiled = new Map();
const linearPatterns = new Map();
const keywordIndex = keywordMatcher(
  gitleaksRules.flatMap((r) =>
    (r.keywords ?? []).map((word) => word.toLowerCase())
  )
);

export function detectGitleaks(text, emit, trace) {
  const keywords = keywordIndex(text.toLowerCase());
  const large = Buffer.byteLength(text) > 4 * 1024 * 1024;
  for (const rule of gitleaksRules) {
    if (
      !rule.regex ||
      (rule.keywords?.length &&
        !rule.keywords.some((word) => keywords.has(word.toLowerCase())))
    ) {
      continue;
    }
    const started = trace ? performance.now() : 0;
    for (const view of ruleViews(text, rule)) {
      scanRule(view.text, view.start, rule, emit, large);
    }
    trace?.({
      rule: rule.id,
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

function scanRule(text, base, rule, emit, large) {
  for (const match of ruleMatches(text, rule, large)) {
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
      rule: `gitleaks/${rule.id}`,
      confidence: rule.entropy ? 0.85 : 0.95,
    });
  }
}

function* ruleMatches(text, rule, large) {
  if (large) {
    // re2-wasm has a fixed 16 MiB heap. RE2JS implements the same linear-time
    // syntax without copying the input into WASM. Its indices are UTF-16.
    yield* linearMatches(text, rule);
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
  let pattern = compiled.get(rule.id);
  if (!pattern) {
    pattern = new RE2(rule.regex, 'gu');
    compiled.set(rule.id, pattern);
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
    yield* linearMatches(text, rule, resume);
  }
}

function* linearMatches(text, rule, resume = 0) {
  let linear = linearPatterns.get(rule.id);
  if (!linear) {
    linear = RE2JS.compile(rule.regex);
    linearPatterns.set(rule.id, linear);
  }
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
  return !secret ||
    secret === REDACTED ||
    (rule.entropy && entropy(secret) < rule.entropy)
    ? undefined
    : secret;
}
