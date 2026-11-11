import { generatedCount } from './fake-memory.js';
import { placeholderState } from './placeholders.js';

// Structured JSON inspects every key and string value as its own text, and a
// verified `sanitize` repeats that inspection for its residual checks. Values
// that did not change between those passes (`"INFO"`, `"field7"`) give the
// same findings, so one call inspects each distinct view once (issue 165).
//
// A result is reused only under an identical policy: the key covers the view
// text, its prose flag, every option (objects by identity, the per-pass
// confirmed-name snapshot by content), the live placeholder map and the
// remembered fake values, which grow when a pass replaces values. Findings are treated as
// read-only; callers map them to new objects.
const memoStore = Symbol('structured-memo');
const identities = new WeakMap();
let nextIdentity = 0;

function identity(value) {
  if (!identities.has(value)) {
    identities.set(value, ++nextIdentity);
  }
  return identities.get(value);
}

function placeholderSignature(options) {
  const map = options[placeholderState]?.map;
  if (!map) {
    return '';
  }
  let values = 0;
  for (const entry of map.entries) {
    values += entry.values?.length ?? 0;
  }
  return `${identity(map)}:${map.entries.length}:${values}`;
}

function fingerprint(options) {
  const parts = [placeholderSignature(options), generatedCount(options)];
  for (const key of Reflect.ownKeys(options)) {
    if (key === memoStore || key === 'findings') {
      continue;
    }
    const value = options[key];
    let part;
    if (key === 'confirmedPersonal' && Array.isArray(value)) {
      // Rebuilt from the placeholder map for every pass of the async engine.
      part = JSON.stringify(value);
    } else if (
      value !== null &&
      (typeof value === 'object' || typeof value === 'function')
    ) {
      part = `#${identity(value)}`;
    } else {
      part = `${typeof value}:${String(value)}`;
    }
    parts.push(`${String(key)}=${part}`);
  }
  return parts.join('\u0001');
}

/** Options for one sanitize call: every pass shares one view memo. */
export function withStructuredMemo(options) {
  return options.structured && !options[memoStore]
    ? { ...options, [memoStore]: { policies: new Map(), results: new Map() } }
    : options;
}

/**
 * Returns `(kind, text, prose, compute)` that runs `compute()` once per
 * distinct view under the current policy. Without a call-level memo the
 * memo covers this inspection only (a key repeated within one record).
 */
export function structuredInspection(options) {
  const { policies, results } = options[memoStore] ?? {
    policies: new Map(),
    results: new Map(),
  };
  // The policy text can hold long option values; keys carry a short id.
  const signature = fingerprint(options);
  if (!policies.has(signature)) {
    policies.set(signature, policies.size);
  }
  const policy = policies.get(signature);
  return (kind, text, prose, compute) => {
    const key = `${kind}:${prose ? 1 : 0}:${policy}:${text}`;
    if (results.has(key)) {
      return { findings: results.get(key), cached: true };
    }
    const findings = compute();
    results.set(key, findings);
    return { findings, cached: false };
  };
}
