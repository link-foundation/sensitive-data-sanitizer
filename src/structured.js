import { structuredInspection } from './structured-memo.js';
import { failure } from './detection.js';
import { documentFieldType } from './document-fields.js';
import { hasPlaceholders } from './placeholders.js';
import { scanField, fieldMatches, builtInEnabled } from './policy.js';
import { vocabularyField } from './vocabulary.js';

// Session metadata is opt-in at the CLI; library callers choose their own
// fields. These names do not grant exemptions to provider/known credentials.
export const sessionStructuralFields = ['id', 'type', 'name', 'description'];

// Advance once through each character. A regexp string matcher can repeatedly
// restart at escaped quotes in a damaged token and become quadratic.
function* lexemes(text) {
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      const start = index;
      index++;
      while (index < text.length && text[index] !== '"') {
        index += text[index] === '\\' ? 2 : 1;
      }
      if (index >= text.length) {
        throw failure('ERR_JSON');
      }
      let next = index + 1;
      while (next < text.length && /\s/.test(text[next])) {
        next++;
      }
      yield {
        raw: text.slice(start, index + 1),
        index: start,
        key: text[next] === ':',
      };
    } else if ('{}[],:'.includes(char)) {
      yield { raw: char, index, key: false };
    }
  }
}

const fieldPath = (frame) => [
  ...frame.path,
  frame.array ? String(frame.index) : frame.field,
];
function stringToken(match, frame, offset) {
  const key = match.key,
    value = JSON.parse(match.raw);
  if (key) {
    frame.field = value;
  }
  return {
    raw: match.raw,
    start: offset + match.index,
    field: key ? '' : frame.field,
    property: key ? value : undefined,
    path: fieldPath(frame),
    key,
  };
}
function tokens(text, offset = 0) {
  const strings = [];
  const stack = [{ field: '', path: [], index: 0, array: false }];
  for (const match of lexemes(text)) {
    const raw = match.raw,
      frame = stack.at(-1);
    if (raw[0] === '"') {
      strings.push(stringToken(match, frame, offset));
    } else if (raw === '{' || raw === '[') {
      const path = stack.length === 1 ? [] : fieldPath(frame);
      stack.push({
        field: raw === '[' ? frame.field : '',
        path,
        array: raw === '[',
        index: 0,
      });
    } else if (raw === '}' || raw === ']') {
      stack.pop();
    } else if (raw === ',' && frame.array) {
      frame.index++;
    }
  }
  return strings;
}
export function structuredBatches(text, options) {
  const leaves = [];
  try {
    if (options.structured === 'json') {
      JSON.parse(text);
      for (const leaf of tokens(text)) {
        leaves.push(leaf);
      }
    } else {
      let offset = 0;
      for (const line of text.split('\n')) {
        if (line.trim()) {
          JSON.parse(line);
          for (const leaf of tokens(line, offset)) {
            leaves.push(leaf);
          }
        }
        offset += line.length + 1;
      }
    }
  } catch {
    throw failure('ERR_JSON');
  }
  const batches = [];
  let parts = [],
    entries = [],
    length = 0;
  const limit = Math.min(
    256 * 1024,
    options.maxInputLength ?? 10 * 1024 * 1024
  );
  for (const leaf of leaves) {
    // Keeping the original escaped token gives exact source offsets without
    // exposing values in finding metadata. Separate keys are scanned too.
    const prefix = leaf.field
      ? `${JSON.stringify(leaf.field.slice(0, 128))}: `
      : '';
    const part = `${prefix + leaf.raw}\n`;
    if (length && length + part.length > limit) {
      batches.push({ text: parts.join('').slice(0, -1), entries });
      parts = [];
      entries = [];
      length = 0;
    }
    entries.push({ ...leaf, batchStart: length + prefix.length });
    parts.push(part);
    length += part.length;
  }
  if (parts.length) {
    batches.push({ text: parts.join('').slice(0, -1), entries });
  }
  return batches;
}

// Schema declarations take priority over metadata/public/fake heuristics.
function configuredFieldType(field, options) {
  if (!options.documentEntities || scanField(field, options)) {
    return undefined;
  }
  const personal = vocabularyField(field, options),
    builtin = documentFieldType(field);
  if (personal === true) {
    return 'PERSON';
  }
  return personal === false && builtin === 'PERSON' ? undefined : builtin;
}
export function structuredFieldFindings(batch, options) {
  return batch.entries.flatMap((entry) => {
    const type = configuredFieldType(entry.field, options);
    const denied =
      options.allowedFields !== undefined &&
      !entry.key &&
      !fieldMatches(
        options.allowedFields,
        entry.field,
        entry.path,
        options.exactFields
      );
    if (
      entry.key ||
      (!type && !denied) ||
      (!denied && entry.raw.length <= 2) ||
      JSON.parse(entry.raw) === '[REDACTED]'
    ) {
      return [];
    }
    return [
      {
        start: entry.start + (denied ? 0 : 1),
        end: entry.start + entry.raw.length - (denied ? 0 : 1),
        type: denied ? 'JSON_VALUE' : type,
        ...(denied && type ? { valueType: type } : {}),
        category: 'personal',
        rule: 'known-personal',
        confidence: 1,
      },
    ].filter((finding) => denied || builtInEnabled(finding, options));
  });
}

export function structuredValueRanges(text, options) {
  return structuredBatches(text, options).flatMap((batch) =>
    batch.entries
      .filter((entry) => !entry.key)
      .map((entry) => ({
        start: entry.start + 1,
        end: entry.start + entry.raw.length - 1,
      }))
  );
}
export function structuredStringRanges(text) {
  return [...lexemes(text)]
    .filter((entry) => entry.raw[0] === '"')
    .map((entry) => ({
      start: entry.index + 1,
      end: entry.index + entry.raw.length - 1,
    }));
}

function weakStructuralFinding(finding, entry, batchText) {
  if (finding.rule.startsWith('strict-')) {
    return true;
  }
  if (
    ['known-secret', 'known-personal', 'confirmed-personal'].includes(
      finding.rule
    )
  ) {
    return false;
  }
  if (finding.category === 'personal') {
    return ['PERSON', 'ORGANIZATION', 'USERNAME', 'ID'].includes(finding.type);
  }
  if (
    ['quoted-entropy', 'entropy', 'gitleaks/generic-api-key'].includes(
      finding.rule
    )
  ) {
    return true;
  }
  if (finding.rule === 'context') {
    const before = batchText.slice(
      Math.max(entry.batchStart, finding.start - 80),
      finding.start
    );
    // Generic "secret: ..." prose in skill descriptions is metadata; actual
    // password/auth context remains sensitive even in declared fields.
    return /\bsecret\s*[:=]\s*["']?$/i.test(before);
  }
  return false;
}
function ordinaryPersonalKey(entry, finding, options = {}) {
  return (
    entry.key &&
    (options.properNames || /^[A-Za-z_$][\w$]*$/.test(JSON.parse(entry.raw))) &&
    finding.category === 'personal' &&
    finding.rule !== 'known-personal'
  );
}
// Propagation runs again at source offsets. Apply the same key policy after it
// so a name confirmed in a value cannot rename an ordinary identifier key.
export function preserveIdentifierKeys(text, findings, options) {
  if (
    !options.structured ||
    (hasPlaceholders(options) && !options.properNames)
  ) {
    return findings;
  }
  const keys = structuredBatches(text, options).flatMap((batch) =>
    batch.entries
      .filter((entry) =>
        ordinaryPersonalKey(entry, { category: 'personal' }, options)
      )
      .map((entry) => ({
        start: entry.start,
        end: entry.start + entry.raw.length,
      }))
  );
  return findings.filter((finding) => {
    if (finding.category !== 'personal' || finding.rule === 'known-personal') {
      return true;
    }
    let low = 0,
      high = keys.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (keys[mid].end <= finding.start) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low === keys.length || keys[low].start >= finding.end;
  });
}
function preserveStructuredEntry(entry, finding, text, options) {
  if (
    !entry.key &&
    scanField(entry.field, options) &&
    (finding.rule === 'label' || finding.rule.startsWith('catalog/'))
  ) {
    return finding.category === 'personal';
  }
  if (options.properNames && ordinaryPersonalKey(entry, finding, options)) {
    return true;
  }
  if (hasPlaceholders(options)) {
    return false;
  }
  return (
    (entry.key &&
      ['confirmed-personal', 'document-propagation'].includes(finding.rule)) ||
    ordinaryPersonalKey(entry, finding, options) ||
    (!entry.key &&
      options.structuralFields?.includes(entry.field) &&
      weakStructuralFinding(finding, entry, text))
  );
}
export function mapStructuredFindings(batch, findings, options) {
  const result = [];
  for (const finding of findings) {
    let low = 0,
      high = batch.entries.length;
    while (low < high) {
      const mid = (low + high) >>> 1,
        entry = batch.entries[mid];
      if (entry.batchStart + entry.raw.length - 1 <= finding.start) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    for (let i = low; i < batch.entries.length; i++) {
      const entry = batch.entries[i];
      const lo = entry.batchStart + 1,
        hi = entry.batchStart + entry.raw.length - 1;
      if (lo >= finding.end) {
        break;
      }
      if (finding.end <= lo || finding.start >= hi) {
        continue;
      }
      if (preserveStructuredEntry(entry, finding, batch.text, options)) {
        continue;
      }
      const start = Math.max(lo, finding.start),
        end = Math.min(hi, finding.end);
      if (end <= start) {
        continue;
      }
      // A detector that crosses a token boundary cannot safely describe a
      // partial string. Redact that string's complete content instead.
      const crosses = finding.start < lo || finding.end > hi;
      result.push({
        ...finding,
        start: entry.start + (crosses ? 1 : start - entry.batchStart),
        end:
          entry.start +
          (crosses ? entry.raw.length - 1 : end - entry.batchStart),
      });
    }
  }
  return result;
}
export function verifyStructured(text, options) {
  structuredBatches(text, options);
  // JSON.parse silently overwrites duplicate keys; prevent loss of meaning
  // when distinct personal keys collapse to the same redaction marker.
  const records =
    options.structured === 'json'
      ? [text]
      : text.split('\n').filter((line) => line.trim());
  for (const record of records) {
    const stack = [];
    for (const match of lexemes(record)) {
      if (match.raw === '{') {
        stack.push(new Set());
      } else if (match.raw === '[') {
        stack.push(undefined);
      } else if (match.raw === '}' || match.raw === ']') {
        stack.pop();
      } else if (match.key) {
        const key = JSON.parse(match.raw),
          keys = stack.at(-1);
        if (keys?.has(key)) {
          throw failure('ERR_JSON_COLLISION');
        }
        keys?.add(key);
      }
    }
  }
}

// Scan decoded strings at their own line start, retaining a map through every
// JSON escape. Both native and asynchronous engines consume these same views.
export function* structuredValueViews(
  batch,
  options,
  depth = 0,
  outerMap = (f) => f
) {
  for (const entry of batch.entries) {
    const value = JSON.parse(entry.raw);
    const offsets = stringOffsets(entry.raw);
    const map = (finding) => {
      const raw = {
        ...finding,
        start: offsets ? offsets.starts[finding.start] : finding.start + 1,
        end: offsets ? offsets.ends[finding.end - 1] : finding.end + 1,
      };
      if (
        preserveStructuredEntry(
          entry,
          {
            ...raw,
            start: entry.batchStart + raw.start,
            end: entry.batchStart + raw.end,
          },
          batch.text,
          options
        )
      ) {
        return undefined;
      }
      return outerMap({
        ...raw,
        start: entry.start + raw.start,
        end: entry.start + raw.end,
      });
    };
    // A serialized container is a transport envelope, not one prose value.
    // Activate the optional scanner only in its independently decoded leaves.
    let batches = [];
    if (depth < 2 && /^[ \t\r\n]*[[{]/.test(value)) {
      try {
        batches = structuredBatches(value, { ...options, structured: 'json' });
      } catch (error) {
        if (error.code !== 'ERR_JSON') {
          throw error;
        }
      }
    }
    yield { text: value, map, prose: !entry.key && batches.length === 0 };
    for (const nested of batches) {
      yield* structuredValueViews(nested, options, depth + 1, map);
    }
  }
}
export function inspectStructuredValues(batch, options, inspectValue) {
  const result = [];
  const memo = structuredInspection(options);
  for (const view of structuredValueViews(batch, options)) {
    const { findings, cached } = memo('value', view.text, view.prose, () =>
      inspectValue(view.text, view.prose)
    );
    options.debug?.({
      event: 'structured-value',
      count: findings.length,
      ...(cached ? { cached } : {}),
    });
    for (const finding of findings) {
      const mapped = view.map(finding);
      if (mapped) {
        result.push(mapped);
      }
    }
  }
  return result;
}
function stringOffsets(raw) {
  if (!raw.includes('\\')) {
    return undefined;
  }
  const starts = [],
    ends = [];
  for (let i = 1; i < raw.length - 1;) {
    const start = i;
    i += raw[i] === '\\' ? (raw[i + 1] === 'u' ? 6 : 2) : 1;
    starts.push(start);
    ends.push(i);
  }
  return { starts, ends };
}

// A caller-declared property replaces its entire JSON value, including containers
// and primitives. Source token offsets preserve the surrounding record.
export function declaredFieldFindings(text, options) {
  if (!options.sensitiveFields?.length && !options.documentEntities) {
    return [];
  }
  const findings = [];
  const records = options.structured === 'jsonl' ? text.split('\n') : [text];
  let offset = 0;
  for (const record of records) {
    for (const token of tokens(record, offset)) {
      if (token.start < (findings.at(-1)?.end ?? 0) || !token.key) {
        continue;
      }
      const finding = declaredValueFinding(text, token, options);
      if (finding) {
        findings.push(finding);
      }
    }
    offset += record.length + 1;
  }
  return findings;
}
function declaredValueFinding(text, token, options) {
  const declared = fieldMatches(
    options.sensitiveFields,
    token.property,
    [...token.path.slice(0, -1), token.property],
    options.exactFields
  );
  const type = configuredFieldType(token.property, options);
  if (!declared && !['AGE', 'DATE_OF_BIRTH'].includes(type)) {
    return undefined;
  }
  let start = token.start + token.raw.length;
  while (/[\s:]/.test(text[start] ?? '') && start < text.length) {
    start++;
  }
  const end = jsonValueEnd(text, start);
  // Strings use structuredFieldFindings. Numeric personal attributes need
  // a whole-value replacement so the resulting JSON stays valid.
  if (
    !declared &&
    !(
      /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text.slice(start, end)) &&
      builtInEnabled(
        { type, rule: 'known-personal', category: 'personal' },
        options
      )
    )
  ) {
    return undefined;
  }
  if (text.slice(start, end) === '"[REDACTED]"') {
    return undefined;
  }
  return {
    start,
    end,
    type: 'JSON_VALUE',
    ...(type ? { valueType: type } : {}),
    category: 'personal',
    rule: 'known-personal',
    confidence: 1,
  };
}
function jsonValueEnd(text, start) {
  let depth = 0,
    quoted = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '\\') {
        i++;
      } else if (char === '"') {
        quoted = false;
        if (!depth) {
          return i + 1;
        }
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === '[' || char === '{') {
      depth++;
    } else if (char === ']' || char === '}') {
      if (!depth) {
        return i;
      }
      if (!--depth) {
        return i + 1;
      }
    } else if (!depth && /[\s,]/.test(char)) {
      return i;
    }
  }
  return text.length;
}
