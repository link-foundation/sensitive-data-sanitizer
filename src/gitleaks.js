import { RE2 } from 're2-wasm';
import r0 from './vendor/gitleaks/rules-0.json' with { type: 'json' };
import r1 from './vendor/gitleaks/rules-1.json' with { type: 'json' };
import r2 from './vendor/gitleaks/rules-2.json' with { type: 'json' };
import r3 from './vendor/gitleaks/rules-3.json' with { type: 'json' };
import r4 from './vendor/gitleaks/rules-4.json' with { type: 'json' };
import r5 from './vendor/gitleaks/rules-5.json' with { type: 'json' };
import { entropy, REDACTED } from './detection.js';

export const gitleaksRules = [...r0, ...r1, ...r2, ...r3, ...r4, ...r5];
const compiled = new Map();

export function detectGitleaks(text, emit) {
  const lower = text.toLowerCase();
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
  for (const rule of gitleaksRules) {
    if (
      !rule.regex ||
      (rule.keywords?.length &&
        !rule.keywords.some((word) => lower.includes(word.toLowerCase())))
    ) {
      continue;
    }
    let pattern = compiled.get(rule.id);
    if (!pattern) {
      pattern = new RE2(rule.regex, 'gu');
      compiled.set(rule.id, pattern);
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
        start: (offsets ? offsets[match.index] : match.index) + offset,
        end:
          (offsets ? offsets[match.index] : match.index) + last + secret.length,
        type: 'SECRET',
        category: 'credential',
        rule: `gitleaks/${rule.id}`,
        confidence: rule.entropy ? 0.85 : 0.95,
      });
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
