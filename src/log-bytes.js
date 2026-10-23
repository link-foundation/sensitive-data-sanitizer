import { TextDecoder } from 'node:util';
import { sequenceWidth, validSequence } from './utf8.js';

// Surrogate escape: invalid bytes use unpaired U+DC80..U+DCFF in the internal
// text view. Valid UTF-8 (including non-BMP characters) keeps its Unicode form.
// encodeLogText restores those bytes after sanitization; no lossy replacement.
export function decodeLogBytes(input) {
  const bytes = Buffer.from(input);
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      bytes
    );
  } catch {
    const parts = [];
    let start = 0;
    for (let i = 0; i < bytes.length; ) {
      const width = sequenceWidth(bytes[i]);
      if (validSequence(bytes, i, width)) {
        i += width;
        continue;
      }
      parts.push(
        bytes.toString('utf8', start, i),
        String.fromCharCode(0xdc00 + bytes[i])
      );
      start = ++i;
    }
    parts.push(bytes.toString('utf8', start));
    return parts.join('');
  }
}

export function encodeLogText(text) {
  const parts = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      text.charCodeAt(i + 1) >= 0xdc00 &&
      text.charCodeAt(i + 1) <= 0xdfff
    ) {
      i++;
    } else if (code >= 0xdc80 && code <= 0xdcff) {
      parts.push(
        Buffer.from(text.slice(start, i)),
        Buffer.from([code - 0xdc00])
      );
      start = i + 1;
    }
  }
  if (!parts.length) {
    return Buffer.from(text);
  }
  parts.push(Buffer.from(text.slice(start)));
  return Buffer.concat(parts);
}

export class LogDecoder {
  pending = Buffer.alloc(0);
  decode(input = Buffer.alloc(0), { stream = false } = {}) {
    const bytes = this.pending.length
      ? Buffer.concat([this.pending, input])
      : Buffer.from(input);
    let end = bytes.length;
    if (stream && end) {
      let start = end - 1;
      while (
        start > 0 &&
        end - start < 4 &&
        bytes[start] >= 0x80 &&
        bytes[start] <= 0xbf
      ) {
        start--;
      }
      const width = sequenceWidth(bytes[start]);
      if (width > end - start) {
        end = start;
      }
    }
    this.pending = Buffer.from(bytes.subarray(end));
    return decodeLogBytes(bytes.subarray(0, end));
  }
}
