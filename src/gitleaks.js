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
import { tokenChecksum } from './token-checksum.js';

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
// re2-wasm has a fixed 16 MiB heap shared by every compiled rule and every
// subject copy, and an allocation failure aborts the module for the rest of
// the process. All bundled rules compiled take about 7 MiB, and each exec
// copies its subject, so keep subjects well below the remaining space and
// scan larger texts with RE2JS (experiments/issue-128/re2-big-input.mjs).
export const WASM_SUBJECT_LIMIT = 1024 * 1024;

export function detectGitleaks(text, emit, trace) {
  const keywords = keywordIndex(text.toLowerCase());
  const large = Buffer.byteLength(text) > WASM_SUBJECT_LIMIT;
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
      scanRule(view, { rule, name }, emit, large);
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
    valueRun.lastIndex = end;
    end += valueRun.exec(text)[0].length;
    end = Math.min(text.length, end + 3);
    coveredEnd = end;
    yield shortenedView(text.slice(start, end), start);
  }
}

// The three targeted rules share one shape: a bounded key part (at most 50
// prefix characters, the keyword, 20 + 3 separator characters and a
// four-character operator) and a secret followed by a terminator. Inside a
// long `[A-Za-z0-9+/]` run there is no operator, quote, `=` or terminator, so
// no match starts or ends there, no secret starts or ends there, and only
// the unbounded `[a-z0-9][a-z0-9+/]{11,}` secret of generic-api-key can cover
// it, as a whole. Every bounded part is shorter than `RUN_EDGE`, and the
// filler is longer than the 150-character secret alternative, so replacing
// the inside of such a run with `RUN_FILLER` changes neither which matches
// RE2 finds nor where they start and end. RE2 then never walks its capture
// NFA over a multi-megabyte value (#173); offsets and secrets are mapped back
// to the original view. experiments/issue-173/equivalence.mjs fuzzes this.
const RUN_EDGE = 256;
const RUN_FILLER = 'A'.repeat(256);
const RUN_MIN = 2 * RUN_EDGE + 2 * RUN_FILLER.length;
// Plain (non-`u`) single-class loops: V8 runs them without a backtracking
// entry per character, on one-byte and two-byte strings alike. A counted
// `[A-Za-z0-9+/]{1024,}` does push one per character and overflows on 16 MiB
// (experiments/issue-173/run-scan.mjs), so probe a fixed block and extend it.
const valueRun = /[\w.=/+-]*/y;
const runBlock = /[A-Za-z0-9+/]{64}/g;
const runRest = /[A-Za-z0-9+/]*/y;

export function shortenedView(text, start) {
  const parts = [];
  const shifts = [];
  let copied = 0,
    removed = 0;
  runBlock.lastIndex = 0;
  for (let block; (block = runBlock.exec(text));) {
    // Scanning resumes after the previous run, so a block starts its run.
    runRest.lastIndex = block.index;
    const end = block.index + runRest.exec(text)[0].length;
    runBlock.lastIndex = end;
    if (end - block.index < RUN_MIN) {
      continue;
    }
    const cut = block.index + RUN_EDGE,
      resume = end - RUN_EDGE,
      filler = cut - removed;
    parts.push(text.slice(copied, cut), RUN_FILLER);
    copied = resume;
    removed += resume - cut - RUN_FILLER.length;
    // Shortened-view offsets after this filler move right by `shift`.
    shifts.push({ at: filler + RUN_FILLER.length, shift: removed });
  }
  if (!shifts.length) {
    return { text, start };
  }
  parts.push(text.slice(copied));
  const position = (offset) => {
    let shift = 0;
    for (const entry of shifts) {
      if (offset >= entry.at) {
        shift = entry.shift;
      }
    }
    return offset + shift;
  };
  return { text: parts.join(''), start, source: text, position };
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

function scanRule(view, { rule, name }, emit, large) {
  const position = view.position ?? ((offset) => offset);
  for (const match of ruleMatches(view.text, name, rule, large)) {
    const captured = capturedText(rule, match);
    if (!captured) {
      continue;
    }
    // RE2's wrapper exposes full-match offsets, not subgroup indices. If the
    // span includes each occurrence when a captured substring is repeated.
    const offset = match.index + match[0].indexOf(captured),
      last = match.index + match[0].lastIndexOf(captured);
    // A shortened view (#173) holds a filler inside long runs: filter and
    // score the secret as it stands in the original text.
    const secret = view.source
      ? view.source.slice(position(offset), position(offset + captured.length))
      : captured;
    if (!acceptedSecret(rule, secret)) {
      continue;
    }
    emit({
      start: view.start + position(offset),
      end: view.start + position(last + captured.length),
      type: 'SECRET',
      category: 'credential',
      rule: name,
      confidence: ruleConfidence(rule, secret),
    });
  }
}

// A token whose embedded CRC32 checksum matches is structurally valid offline.
function ruleConfidence(rule, secret) {
  if (tokenChecksum(secret)) {
    return 0.99;
  }
  return confidence[rule.confidence] ?? (rule.entropy ? 0.85 : 0.95);
}

function* ruleMatches(text, name, rule, large) {
  if (large) {
    // RE2JS implements the same linear-time syntax without copying the input
    // into WASM. Its indices are UTF-16.
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
  const pattern = compiledRule(name, rule.regex);
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

// One cached re2-wasm object per rule name. re2-wasm objects are never freed,
// so every caller, tests included, shares this cache.
export function compiledRule(name, source) {
  let pattern = compiled.get(name);
  if (!pattern) {
    pattern = new RE2(source, 'gu');
    compiled.set(name, pattern);
  }
  return pattern;
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

function capturedText(rule, match) {
  return rule.secretGroup
    ? match[rule.secretGroup]
    : (match.slice(1).find(Boolean) ?? match[0]);
}

function acceptedSecret(rule, secret) {
  return Boolean(secret) && secret !== REDACTED && !filtered(rule, secret);
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
