import { TextDecoder } from 'node:util';
import { Buffer } from 'node:buffer';
import { jsonStringRuns } from './json-string-runs.js';

// Decoded candidates are re-scanned by every detector, so their number is
// bounded per window of the input; a denser window falls back to masking the
// remaining candidates as `encoded-limit` runs, without blocking the text.
const WINDOW = 65536;
const WINDOW_CANDIDATES = 4096;
// Inspect a complete bounded binary payload, including any embedded text.
// Ordinary text detection retains its 8 KiB cap.
const WRAPPED_BINARY_LIMIT = 256 * 1024;

const WRAPPED =
  /(?<![A-Za-z0-9_+/-])[A-Za-z0-9_+/-]{16,128}(?:\r?\n[A-Za-z0-9_+/-]{1,128})+={0,2}(?![A-Za-z0-9_+/-])/g;

export function* decodedRuns(text, depth = 0) {
  if (depth >= 2) {
    return;
  }
  // Wrapped runs come first: a line inside a decoded wrapped run is covered
  // by the run's own finding and is not decoded again.
  const patterns = [
    WRAPPED,
    /(?<![A-Za-z0-9_+/-])[A-Za-z0-9_+/-]{16}[A-Za-z0-9_+/-]*={0,2}(?![A-Za-z0-9_+/-])/g,
    /(?:[^\s"'<>?=&:/]{0,128}%[\da-fA-F]{2})+(?:[^\s"'<>?=&:/]{0,128})/g,
    /(?:&#(?:x[\da-fA-F]{1,6}|\d{1,7});|&(?:amp|lt|gt|quot|apos|nbsp);){2,2048}/g,
    /(?:\\x[\da-fA-F]{2}){2,2048}/g,
    undefined, // JSON candidates use a linear scanner below.
  ];
  const scan = { depth, seen: new Set(), counts: new Map(), covered: [] };
  for (const [index, pattern] of patterns.entries()) {
    const marker = ['\n', '', '%', '&', '\\x', '"'][index];
    if (marker && !text.includes(marker)) {
      continue;
    }
    const inWrappedRun = coverage(scan.covered);
    for (const match of candidateMatches(text, pattern)) {
      if (index !== 1 || !inWrappedRun(match.index)) {
        yield* matchRuns(match, index === 0, scan);
      }
    }
  }
}

// Tests ascending offsets against the sorted, disjoint wrapped runs.
function coverage(covered) {
  let cursor = 0;
  return (start) => {
    while (cursor < covered.length && covered[cursor].end <= start) {
      cursor++;
    }
    return cursor < covered.length && covered[cursor].start <= start;
  };
}

function* matchRuns(match, wrapped, scan) {
  const raw = match[0];
  const start = match.index;
  const end = start + raw.length;
  const limited = { start, end, limited: true, depth: scan.depth };
  const candidates = runCandidates(raw, wrapped);
  if (!candidates) {
    if (isLimitedTextRun(raw, wrapped)) {
      scan.covered.push(limited);
      yield limited;
    }
    return;
  }
  const window = Math.floor(start / WINDOW);
  for (const candidate of candidates) {
    const { text: decoded, encoding } = candidate;
    const key = `${start}:${raw.length}:${decoded}`;
    if (scan.seen.has(key) || !decodedText(raw, decoded)) {
      continue;
    }
    scan.seen.add(key);
    const count = (scan.counts.get(window) ?? 0) + 1;
    scan.counts.set(window, count);
    if (count > WINDOW_CANDIDATES) {
      yield limited;
      return;
    }
    if (wrapped && scan.covered.at(-1)?.start !== start) {
      scan.covered.push({ start, end });
    }
    const inset = encoding === 'json-content' ? 1 : 0;
    const run = {
      start: start + inset,
      end: end - inset,
      text: decoded,
      encoding,
      depth: scan.depth,
      ...(candidate.layout && { layout: candidate.layout }),
    };
    yield run;
    for (const inner of decodedRuns(decoded, scan.depth + 1)) {
      yield inner.limited
        ? { ...limited, depth: inner.depth }
        : { ...run, text: inner.text, depth: inner.depth };
    }
  }
}

function runCandidates(raw, wrapped) {
  if (raw.length <= 8192) {
    return decodeCandidates(raw);
  }
  const binary = wrapped && boundedWrappedBinary(raw);
  return binary ? [binary] : undefined;
}

function boundedWrappedBinary(raw) {
  if (raw.length > WRAPPED_BINARY_LIMIT || !isWrappedBinary(raw)) {
    return false;
  }
  const bytes = base64Bytes(raw.replace(/\s/g, ''));
  if (!bytes) {
    return false;
  }
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (decodedText(raw, decoded)) {
      return undefined;
    }
  } catch {
    /* Binary content still needs an embedded-text detection view. */
  }
  return {
    encoding: 'binary',
    // Preserve text offsets within the view while separating binary controls
    // and invalid UTF-8. This view is never used to reconstruct binary bytes.
    text: bytes
      .toString('utf8')
      // eslint-disable-next-line no-control-regex -- Replace binary controls in the text detection view.
      .replace(/[\x00-\x08\x0e-\x1f\x7f\ufffd]/g, ' '),
  };
}

function candidateMatches(text, pattern) {
  return pattern ? text.matchAll(pattern) : jsonStringRuns(text);
}

function decodedText(raw, decoded) {
  return (
    decoded !== raw &&
    Boolean(decoded) &&
    // eslint-disable-next-line no-control-regex -- Binary controls cannot form text detection views.
    !/[\x00-\x08\x0e-\x1f\x7f]/.test(decoded)
  );
}

function isLimitedTextRun(raw, wrapped) {
  // Bare opaque identifiers may share the base64 alphabet. Require a
  // textual decode, an explicit percent encoding, or the uniform layout of
  // wrapped base64 (`base64 -w`, PEM bodies). Lists of identifiers or commit
  // hashes are ordinary lines and are scanned one by one.
  if (raw.includes('%')) {
    return true;
  }
  const head = wrapped
    ? raw.slice(0, 8192).replace(/\s/g, '').slice(0, 4096)
    : raw.slice(0, 4096);
  const probe = decodeCandidates(head, true);
  return (
    probe.some(
      // eslint-disable-next-line no-control-regex -- Exclude binary controls from the bounded UTF-8 text probe.
      (c) => c.text && !/[\x00-\x08\x0e-\x1f\x7f]/.test(c.text)
    ) ||
    (wrapped && isWrappedBinary(raw))
  );
}

// Wrapped binary base64 uses the standard alphabet, lines of one width that
// is a multiple of four and is not plain hexadecimal.
function isWrappedBinary(raw) {
  // Trim the padding without a regular expression: `/=+$/` backtracks
  // quadratically over long `=` runs that are not at the end.
  let end = raw.length;
  while (end > 0 && raw.charCodeAt(end - 1) === 61) {
    end -= 1;
  }
  const lines = raw.slice(0, end).split(/\r?\n/);
  const width = lines[0].length;
  return (
    width % 4 === 0 &&
    !/[-_]/.test(raw) &&
    !/^[\da-fA-F\s]+$/.test(raw) &&
    lines.every((line, i) =>
      i === lines.length - 1 ? line.length <= width : line.length === width
    )
  );
}

// Line width and separator of a wrapped run, re-applied when re-encoding.
function wrapLayout(raw) {
  if (!raw.includes('\n')) {
    return undefined;
  }
  return {
    width: raw.split(/\r?\n/, 1)[0].length,
    newline: raw.includes('\r\n') ? '\r\n' : '\n',
  };
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
    const bytes = base64Bytes(compact);
    if (bytes) {
      try {
        candidates.push({
          encoding:
            compact.includes('-') || compact.includes('_')
              ? 'base64url'
              : 'base64',
          text: new TextDecoder('utf-8', { fatal: true }).decode(bytes, {
            stream: partial,
          }),
          layout: wrapLayout(raw),
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
          layout: wrapLayout(raw),
        });
      } catch {
        /* Binary content. */
      }
    }
  }
  return candidates;
}

function base64Bytes(compact) {
  const bytes = Buffer.from(compact, 'base64url');
  return bytes.toString('base64url') ===
    compact.replace(/=+$/, '').replaceAll('+', '-').replaceAll('/', '_')
    ? bytes
    : undefined;
}

export function encodeRun(run, text) {
  if (run.encoding === 'binary') {
    return undefined;
  }
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
    encoded = wrap(bytes.toString(run.encoding), run.layout);
  }
  const decoded =
    run.encoding === 'json-content'
      ? { text: JSON.parse(`"${encoded}"`) }
      : decodeCandidates(encoded).find((c) => c.encoding === run.encoding);
  // A short payload may re-encode below the length a decoder recognizes
  // (hex needs 32 digits); callers then mask the encoded text as it stands.
  return decoded?.text === text ? encoded : undefined;
}

function wrap(encoded, layout) {
  if (!layout?.width || encoded.length <= layout.width) {
    return encoded;
  }
  const lines = [];
  for (let i = 0; i < encoded.length; i += layout.width) {
    lines.push(encoded.slice(i, i + layout.width));
  }
  // Padding never starts a line of its own.
  if (/^=+$/.test(lines.at(-1)) && lines.length > 1) {
    lines[lines.length - 2] += lines.pop();
  }
  return lines.join(layout.newline);
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
