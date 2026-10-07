import { TextDecoder } from 'node:util';
import { Buffer } from 'node:buffer';
import { failure } from './detection.js';

export function* decodedRuns(text, depth = 0) {
  if (depth >= 2) {
    return;
  }
  const patterns = [
    /(?<![A-Za-z0-9_+/-])[A-Za-z0-9_+/-]{16,8192}={0,2}(?![A-Za-z0-9_+/-])/g,
    /(?:[^\s"'<>?=&:/]{0,128}%[\da-fA-F]{2})+(?:[^\s"'<>?=&:/]{0,128})/g,
    /(?<![A-Za-z0-9_+/-])[A-Za-z0-9_+/-]{16,128}(?:\r?\n[A-Za-z0-9_+/-]{16,128})+={0,2}(?![A-Za-z0-9_+/-])/g,
  ];
  const seen = new Set();
  let count = 0;
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[0];
      if (raw.length > 8192) {
        throw failure('ERR_LIMIT');
      }
      const candidates = decodeCandidates(raw);
      for (const decoded of candidates) {
        const key = `${match.index}:${raw.length}:${decoded}`;
        if (
          seen.has(key) ||
          decoded === raw ||
          !decoded ||
          // eslint-disable-next-line no-control-regex -- Binary control characters cannot form a text detection view.
          /[\x00-\x08\x0e-\x1f\x7f]/.test(decoded)
        ) {
          continue;
        }
        seen.add(key);
        if (++count > 256) {
          throw failure('ERR_LIMIT');
        }
        const run = {
          start: match.index,
          end: match.index + raw.length,
          text: decoded,
        };
        yield run;
        for (const inner of decodedRuns(decoded, depth + 1)) {
          yield { ...run, text: inner.text };
        }
      }
    }
  }
}

function decodeCandidates(raw) {
  const candidates = [];
  if (raw.includes('%')) {
    try {
      candidates.push(decodeURIComponent(raw));
    } catch {
      return [];
    }
  } else {
    const compact = raw.replace(/\s/g, '');
    // Decode canonical base64 text only.
    const bytes = Buffer.from(compact, 'base64url');
    if (
      bytes.toString('base64url') ===
      compact.replace(/=+$/, '').replaceAll('+', '-').replaceAll('/', '_')
    ) {
      try {
        candidates.push(
          new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        );
      } catch {
        /* Binary content. */
      }
    }
    if (/^(?:[a-fA-F0-9]{2}){16,}$/.test(compact)) {
      try {
        candidates.push(
          new TextDecoder('utf-8', { fatal: true }).decode(
            Buffer.from(compact, 'hex')
          )
        );
      } catch {
        /* Binary content. */
      }
    }
  }
  return candidates;
}
