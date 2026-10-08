import { TextDecoder } from 'node:util';
import { Buffer } from 'node:buffer';
import { failure } from './detection.js';

export function* decodedRuns(text, depth = 0) {
  if (depth >= 2) {
    return;
  }
  const patterns = [
    /(?<![A-Za-z0-9_+/-])[A-Za-z0-9_+/-]{16,}={0,2}(?![A-Za-z0-9_+/-])/g,
    /(?:[^\s"'<>?=&:/]{0,128}%[\da-fA-F]{2})+(?:[^\s"'<>?=&:/]{0,128})/g,
    /(?<![A-Za-z0-9_+/-])[A-Za-z0-9_+/-]{16,128}(?:\r?\n[A-Za-z0-9_+/-]{1,128})+={0,2}(?![A-Za-z0-9_+/-])/g,
    /(?:&#(?:x[\da-fA-F]{1,6}|\d{1,7});|&(?:amp|lt|gt|quot|apos|nbsp);){2,2048}/g,
    /(?:\\x[\da-fA-F]{2}){2,2048}/g,
    /"(?:[^"\\\r\n]|\\[^\r\n]){1,8192}"/g,
  ];
  const seen = new Set();
  let count = 0;
  for (const [index, pattern] of patterns.entries()) {
    const marker = ['', '%', '\n', '&', '\\x', '"'][index];
    if (marker && !text.includes(marker)) {
      continue;
    }
    for (const match of text.matchAll(pattern)) {
      const raw = match[0];
      if (raw.length > 8192) {
        if (isLimitedTextRun(raw)) {
          yield {
            start: match.index,
            end: match.index + raw.length,
            limited: true,
            depth,
          };
        }
        continue;
      }
      const candidates = decodeCandidates(raw);
      for (const candidate of candidates) {
        const { text: decoded, encoding } = candidate;
        const key = `${match.index}:${raw.length}:${decoded}`;
        if (seen.has(key) || !decodedText(raw, decoded)) {
          continue;
        }
        seen.add(key);
        if (++count > 4096) {
          throw failure('ERR_LIMIT');
        }
        const inset = encoding === 'json-content' ? 1 : 0;
        const run = {
          start: match.index + inset,
          end: match.index + raw.length - inset,
          text: decoded,
          encoding,
          depth,
        };
        yield run;
        for (const inner of decodedRuns(decoded, depth + 1)) {
          yield { ...run, text: inner.text, depth: inner.depth };
        }
      }
    }
  }
}

function decodedText(raw, decoded) {
  return (
    decoded !== raw &&
    Boolean(decoded) &&
    // eslint-disable-next-line no-control-regex -- Binary controls cannot form text detection views.
    !/[\x00-\x08\x0e-\x1f\x7f]/.test(decoded)
  );
}

function isLimitedTextRun(raw) {
  // Bare opaque identifiers may share the base64 alphabet. Require a
  // textual decode, or an explicit percent/wrapped encoding boundary.
  const probe = decodeCandidates(raw.slice(0, 4096), true);
  return (
    raw.includes('%') ||
    raw.includes('\n') ||
    probe.some(
      // eslint-disable-next-line no-control-regex -- Exclude binary controls from the bounded UTF-8 text probe.
      (c) => c.text && !/[\x00-\x08\x0e-\x1f\x7f]/.test(c.text)
    )
  );
}

function decodeCandidates(raw, partial) {
  const candidates = [];
  if (raw.startsWith('"')) {
    return decodeJson(raw);
  }
  if (raw.startsWith('&#') || /^&(?:amp|lt|gt|quot|apos|nbsp);/.test(raw)) {
    candidates.push({
      encoding: raw.startsWith('&#x') ? 'html-hex' : 'html-decimal',
      text: raw.replace(
        /&(?:#(x[\da-fA-F]+|\d+)|(amp|lt|gt|quot|apos|nbsp));/g,
        (whole, code, named) => {
          if (named) {
            return {
              amp: '&',
              lt: '<',
              gt: '>',
              quot: '"',
              apos: "'",
              nbsp: ' ',
            }[named];
          }
          const point =
            code[0] === 'x' ? parseInt(code.slice(1), 16) : Number(code);
          return point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
            ? String.fromCodePoint(point)
            : whole;
        }
      ),
    });
  } else if (raw.startsWith('\\x')) {
    try {
      candidates.push({
        encoding: 'byte-escape',
        text: new TextDecoder('utf-8', { fatal: true }).decode(
          Buffer.from(raw.replaceAll('\\x', ''), 'hex')
        ),
      });
    } catch {
      /* Non-text bytes. */
    }
  } else if (raw.includes('%')) {
    try {
      candidates.push({ encoding: 'percent', text: decodeURIComponent(raw) });
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
        candidates.push({
          encoding:
            compact.includes('-') || compact.includes('_')
              ? 'base64url'
              : 'base64',
          text: new TextDecoder('utf-8', { fatal: true }).decode(bytes, {
            stream: partial,
          }),
          wrapped: raw.includes('\n'),
          padded: raw.endsWith('='),
        });
      } catch {
        /* Binary content. */
      }
    }
    if (/^(?:[a-fA-F0-9]{2}){16,}$/.test(compact)) {
      try {
        candidates.push({
          encoding: 'hex',
          text: new TextDecoder('utf-8', { fatal: true }).decode(
            Buffer.from(compact, 'hex')
          ),
        });
      } catch {
        /* Binary content. */
      }
    }
  }
  return candidates;
}

export function encodeRun(run, text) {
  const bytes = Buffer.from(text, 'utf8');
  let encoded;
  if (run.encoding === 'json-content') {
    encoded = JSON.stringify(text).slice(1, -1);
  } else if (run.encoding === 'percent') {
    encoded = Array.from(
      bytes,
      (b) => `%${b.toString(16).padStart(2, '0')}`
    ).join('');
  } else if (run.encoding === 'byte-escape') {
    encoded = Array.from(
      bytes,
      (b) => `\\x${b.toString(16).padStart(2, '0')}`
    ).join('');
  } else if (run.encoding.startsWith('html-')) {
    encoded = Array.from(text, (c) =>
      run.encoding === 'html-hex'
        ? `&#x${c.codePointAt(0).toString(16)};`
        : `&#${c.codePointAt(0)};`
    ).join('');
  } else {
    encoded = bytes.toString(run.encoding);
  }
  const decoded =
    run.encoding === 'json-content'
      ? { text: JSON.parse(`"${encoded}"`) }
      : decodeCandidates(encoded).find((c) => c.encoding === run.encoding);
  if (!decoded || decoded.text !== text) {
    throw failure('ERR_ENCODING');
  }
  return encoded;
}

export function encodedValue(raw) {
  for (const run of decodedRuns(raw)) {
    if (run.start === 0 && run.end === raw.length && run.depth === 0) {
      return run;
    }
  }
  if (raw.includes('\\')) {
    try {
      return { encoding: 'json-content', text: JSON.parse(`"${raw}"`) };
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function decodeJson(raw) {
  if (!raw.includes('\\')) {
    return [];
  }
  try {
    return [{ encoding: 'json-content', text: JSON.parse(raw) }];
  } catch {
    return [];
  }
}
