import { failure, REDACTED } from './detection.js';
import { LogDecoder, encodeLogText } from './log-bytes.js';
import { StreamBoundary } from './stream-boundaries.js';

const chunkBytes = 64 * 1024;
export const omissionBytes = Buffer.byteLength(JSON.stringify(REDACTED)) + 2;

// Slice caller-owned byte chunks without copying them. Convert large string
// chunks in bounded pieces and keep any surrogate pair intact.
export function* bytePieces(chunk) {
  if (typeof chunk === 'string') {
    for (let start = 0; start < chunk.length;) {
      let end = Math.min(start + chunkBytes / 4, chunk.length);
      if (/[\uD800-\uDBFF]/.test(chunk[end - 1])) {
        end = Math.min(end + 1, chunk.length);
      }
      yield Buffer.from(chunk.slice(start, end));
      start = end;
    }
    return;
  }
  const bytes = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  for (let start = 0; start < bytes.length; start += chunkBytes) {
    yield bytes.subarray(start, start + chunkBytes);
  }
}

// A verifier can depend on unbounded context (for example a long quoted
// assignment, or a caller-supplied detector). Emit no source bytes for a
// record that cannot be inspected in full, and keep advancing its framing.
export async function* boundedRecords(source, config) {
  const { structured, allowBinary, maxTotalBytes, maxRecordBytes } = config;
  const decoder = new LogDecoder();
  const framing = structured ? undefined : new StreamBoundary();
  let parts = [],
    length = 0,
    total = 0,
    baseOffset = 0,
    record = 1;
  let lastByte,
    separator = '',
    lastProgress = 0;

  function append(bytes, final = false) {
    const offset = length - decoder.pending.length;
    const text = final
      ? decoder.decode()
      : decoder.decode(bytes, { stream: true });
    if (structured) {
      const invalid = /[\uDC80-\uDCFF]/u.exec(text);
      if (invalid) {
        const recordOffset =
          offset + Buffer.byteLength(text.slice(0, invalid.index));
        throw failure('ERR_ENCODING', {
          record,
          recordOffset,
          offset: baseOffset + recordOffset,
        });
      }
    }
    if (bytes.length) {
      const beforeLast = bytes.length === 1 ? lastByte : bytes.at(-2);
      lastByte = bytes.at(-1);
      separator = lastByte === 10 ? (beforeLast === 13 ? '\r\n' : '\n') : '';
    }
    length += bytes.length;
    if (length <= maxRecordBytes) {
      if (text) {
        parts.push(text);
      }
    } else if (parts.length) {
      parts = [];
    }
    return text;
  }

  function release() {
    const text =
      length <= maxRecordBytes
        ? parts.join('')
        : (structured ? JSON.stringify(REDACTED) : REDACTED) + separator;
    record++;
    baseOffset += length;
    length = 0;
    parts = [];
    lastByte = undefined;
    separator = '';
    return text;
  }

  for await (const chunk of source) {
    for (const bytes of bytePieces(chunk)) {
      total += bytes.length;
      if (total > maxTotalBytes) {
        throw failure('ERR_LIMIT');
      }
      if (!allowBinary && bytes.includes(0)) {
        throw failure('ERR_BINARY');
      }
      if (total - lastProgress >= 1024 * 1024) {
        config.onProgress?.();
        lastProgress = total;
      }
      let start = 0;
      while (start < bytes.length) {
        const newline = structured === 'json' ? -1 : bytes.indexOf(10, start);
        const end = newline < 0 ? bytes.length : newline + 1;
        const text = append(bytes.subarray(start, end));
        const boundary = framing
          ? framing.advance(text, newline >= 0)
          : newline >= 0;
        if (boundary) {
          yield release();
        }
        start = end;
      }
    }
  }
  append(Buffer.alloc(0), true);
  if (length) {
    yield release();
  }
}

export async function* recordBatches(records, batchBytes) {
  let parts = [],
    length = 0;
  for await (const record of records) {
    const bytes = /[\uDC80-\uDCFF]/u.test(record)
      ? encodeLogText(record).length
      : Buffer.byteLength(record);
    if (length && length + bytes > batchBytes) {
      yield parts.join('');
      parts = [];
      length = 0;
    }
    parts.push(record);
    length += bytes;
    if (length >= batchBytes) {
      yield parts.join('');
      parts = [];
      length = 0;
    }
  }
  if (length) {
    yield parts.join('');
  }
}
