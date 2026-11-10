import { failure, escapePattern } from './detection.js';

// Declarative recognizers in the style of Presidio's PatternRecognizer
// (patterns with scores, deny lists, context words, validate_result) and
// Google custom infoTypes (regex/dictionary plus hotword likelihood rules).
// The result is an ordinary Detector, so it composes with every other port.
const typePattern = /^[A-Z][A-Z0-9_]{0,63}$/;
const rulePattern = /^[a-z0-9@/._-]{1,120}$/;
const maxPatterns = 64,
  maxWords = 10000;

const score = (value) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;
const optional = (value, test) => value === undefined || test(value);
const words = (list) =>
  Array.isArray(list) &&
  list.length <= maxWords &&
  list.every((word) => typeof word === 'string' && word.trim().length > 0);

const validEntry = (raw) =>
  Boolean(raw) &&
  (raw.regex instanceof RegExp ||
    (typeof raw.regex === 'string' && raw.regex.length > 0)) &&
  optional(raw.confidence, score) &&
  optional(raw.group, (group) => Number.isSafeInteger(group) && group >= 0);

function globalRegex(regex) {
  try {
    return regex instanceof RegExp
      ? new RegExp(
          regex.source,
          regex.flags.includes('g') ? regex.flags : `${regex.flags}g`
        )
      : new RegExp(regex, 'gu');
  } catch {
    throw failure('ERR_CONFIG');
  }
}

function compile(entry) {
  const raw =
    entry instanceof RegExp || typeof entry === 'string'
      ? { regex: entry }
      : entry;
  if (!validEntry(raw)) {
    throw failure('ERR_CONFIG');
  }
  return {
    regex: globalRegex(raw.regex),
    confidence: raw.confidence,
    group: raw.group ?? 0,
  };
}

function window(value) {
  if (value === undefined) {
    return { before: 64, after: 16 };
  }
  const shape = typeof value === 'number' ? { before: value, after: 0 } : value;
  if (
    !shape ||
    ![shape.before ?? 0, shape.after ?? 0].every(
      (n) => Number.isSafeInteger(n) && n >= 0 && n <= 4096
    )
  ) {
    throw failure('ERR_CONFIG');
  }
  return { before: shape.before ?? 0, after: shape.after ?? 0 };
}

const specChecks = [
  (spec) => typePattern.test(spec.type ?? ''),
  (spec) =>
    optional(spec.category, (c) => ['personal', 'credential'].includes(c)),
  (spec) => optional(spec.rule, (rule) => rulePattern.test(rule)),
  (spec) => optional(spec.confidence, score),
  (spec) => optional(spec.denyListConfidence, score),
  (spec) =>
    optional(
      spec.patterns,
      (list) => Array.isArray(list) && list.length <= maxPatterns
    ),
  (spec) => optional(spec.denyList, words),
  (spec) => optional(spec.context, words),
  (spec) =>
    optional(
      spec.contextBoost,
      (boost) => typeof boost === 'number' && Math.abs(boost) <= 1
    ),
  (spec) => optional(spec.validate, (fn) => typeof fn === 'function'),
  (spec) => Boolean(spec.patterns?.length || spec.denyList?.length),
];

function compileSpec(spec) {
  if (
    !spec ||
    typeof spec !== 'object' ||
    !specChecks.every((check) => check(spec))
  ) {
    throw failure('ERR_CONFIG');
  }
  const patterns = (spec.patterns ?? []).map(compile);
  if (spec.denyList?.length) {
    patterns.push({
      regex: new RegExp(
        `(?<![\\p{L}\\p{N}_])(?:${[...spec.denyList]
          .sort((a, b) => b.length - a.length)
          .map(escapePattern)
          .join('|')})(?![\\p{L}\\p{N}_])`,
        spec.caseSensitive ? 'gu' : 'giu'
      ),
      confidence: spec.denyListConfidence ?? 1,
      group: 0,
    });
  }
  const context = spec.context?.length
    ? new RegExp(
        `(?<![\\p{L}\\p{N}])(?:${spec.context.map(escapePattern).join('|')})(?![\\p{L}\\p{N}])`,
        'iu'
      )
    : undefined;
  return Object.freeze({
    type: spec.type,
    category: spec.category ?? 'personal',
    rule: spec.rule ?? 'custom-pattern',
    confidence: spec.confidence ?? 0.6,
    patterns,
    context,
    window: window(spec.contextWindow),
    boost: spec.contextBoost ?? 0.35,
    validate: spec.validate,
  });
}

function scored(spec, base, text, start, end, value) {
  let confidence = base;
  if (
    spec.context?.test(
      `${text.slice(Math.max(0, start - spec.window.before), start)}\n${text.slice(end, end + spec.window.after)}`
    )
  ) {
    // Presidio raises a context-supported score by 0.35 with a 0.4 floor;
    // a negative boost models Google's "decrease likelihood" hotwords.
    confidence =
      spec.boost >= 0
        ? Math.max(0.4, confidence + spec.boost)
        : confidence + spec.boost;
  }
  if (spec.validate) {
    const verdict = spec.validate(value);
    if (verdict === false) {
      return undefined;
    }
    if (typeof verdict === 'number' && score(verdict)) {
      confidence = verdict;
    }
  }
  return Math.min(1, Math.max(0, confidence));
}

function* matches(spec, text) {
  for (const pattern of spec.patterns) {
    pattern.regex.lastIndex = 0;
    for (const match of text.matchAll(pattern.regex)) {
      const value = match[pattern.group];
      if (!value) {
        continue;
      }
      const start = match.index + (pattern.group ? match[0].indexOf(value) : 0);
      yield {
        start,
        end: start + value.length,
        value,
        base: pattern.confidence ?? spec.confidence,
      };
    }
  }
}

/**
 * Builds a synchronous Detector from declarative specs. Each spec matches
 * `patterns` (RegExp, string sources or `{regex, confidence, group}`) and/or
 * a whole-word `denyList`, raises or lowers confidence when a `context` word
 * occurs within `contextWindow`, and lets `validate(value)` reject a match
 * (false) or set its confidence (0–1). Patterns are trusted configuration:
 * avoid catastrophic backtracking in caller-supplied expressions.
 */
export function createPatternDetector(specs, { id = 'pattern-rules' } = {}) {
  const list = Array.isArray(specs) ? specs : [specs];
  if (!list.length || list.length > maxPatterns) {
    throw failure('ERR_CONFIG');
  }
  const compiled = list.map(compileSpec);
  return {
    id,
    detect(text) {
      const findings = [];
      for (const spec of compiled) {
        for (const { start, end, value, base } of matches(spec, text)) {
          const confidence = scored(spec, base, text, start, end, value);
          if (confidence !== undefined) {
            findings.push({
              start,
              end,
              type: spec.type,
              category: spec.category,
              rule: spec.rule,
              confidence,
            });
          }
        }
      }
      return findings;
    },
  };
}
