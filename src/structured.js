import { failure } from './detection.js';

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

function tokens(text, offset = 0) {
  const strings = [];
  const stack = [{ field: '' }];
  for (const match of lexemes(text)) {
    const raw = match.raw,
      frame = stack.at(-1);
    if (raw[0] === '"') {
      const key = match.key;
      const value = JSON.parse(raw);
      if (key) {
        frame.field = value;
      }
      strings.push({
        raw,
        start: offset + match.index,
        field: key ? '' : frame.field,
        key,
      });
    } else if (raw === '{' || raw === '[') {
      stack.push({ field: frame.field });
    } else if (raw === '}' || raw === ']') {
      stack.pop();
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

function weakStructuralFinding(finding, entry, batchText) {
  if (finding.rule === 'known-secret' || finding.rule === 'known-personal') {
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
      const structural =
        !entry.key && options.structuralFields?.includes(entry.field);
      if (structural && weakStructuralFinding(finding, entry, batch.text)) {
        continue;
      }
      const start = Math.max(lo, finding.start),
        end = Math.min(hi, finding.end);
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
