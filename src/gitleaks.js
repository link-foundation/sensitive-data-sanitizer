import { RE2 } from 're2-wasm';
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
const keywordIndex = keywordMatcher(
  gitleaksRules.flatMap((r) =>
    (r.keywords ?? []).map((word) => word.toLowerCase())
  )
);

export function detectGitleaks(text, emit) {
  const keywords = keywordIndex(text.toLowerCase());
  for (const rule of gitleaksRules) {
    if (
      !rule.regex ||
      (rule.keywords?.length &&
        !rule.keywords.some((word) => keywords.has(word.toLowerCase())))
    ) {
      continue;
    }
    let pattern = compiled.get(rule.id);
    if (!pattern) {
      pattern = new RE2(rule.regex, 'gu');
      compiled.set(rule.id, pattern);
    }
    for (const view of ruleViews(text, rule)) {
      scanRule(view.text, view.start, rule, pattern, emit);
    }
  }
}

function* ruleViews(text, rule) {
  const targeted = {
    'generic-api-key':
      /access|auth|api|credential|creds|key|passw(?:or)?d|secret|token/gi,
    'hashicorp-tf-password': /administrator_login_password|password/gi,
  }[rule.id];
  if (!targeted) {
    yield { text, start: 0 };
    return;
  }
  // These two vendored rules have <=50 prefix characters and <=31 characters
  // between their required keyword and secret. Scan near each keyword instead
  // of recopying an entire session into WASM for every match. Extend the only
  // unbounded secret alternative to its real terminator; never truncate it.
  for (const match of text.matchAll(targeted)) {
    let start = Math.max(0, match.index - 50),
      end = Math.min(text.length, match.index + 384);
    if (/[\uDC00-\uDFFF]/.test(text[start] ?? '')) {
      start--;
    }
    while (end < text.length && /[\w.=/+-]/.test(text[end])) {
      end++;
    }
    end = Math.min(text.length, end + 3);
    yield { text: text.slice(start, end), start };
  }
}

function scanRule(text, base, rule, pattern, emit) {
  // re2-wasm 1.0.2 returns codepoint indices despite its RegExp-like API.
  // Convert once per view, and keep its search cursor in codepoints too.
  let offsets;
  if (/[\uD800-\uDBFF]/.test(text)) {
    offsets = [0];
    let offset = 0;
    for (const char of text) {
      offset += char.length;
      offsets.push(offset);
    }
  }
  pattern.lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    pattern.lastIndex =
      match.index + Array.from(match[0]).length || pattern.lastIndex + 1;
    const secret = capturedSecret(rule, match);
    if (!secret) {
      continue;
    }
    // RE2's wrapper exposes full-match offsets, not subgroup indices. If the
    // span includes each occurrence when a captured substring is repeated.
    const offset = match[0].indexOf(secret),
      last = match[0].lastIndexOf(secret);
    emit({
      start: base + (offsets ? offsets[match.index] : match.index) + offset,
      end:
        base +
        (offsets ? offsets[match.index] : match.index) +
        last +
        secret.length,
      type: 'SECRET',
      category: 'credential',
      rule: `gitleaks/${rule.id}`,
      confidence: rule.entropy ? 0.85 : 0.95,
    });
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
