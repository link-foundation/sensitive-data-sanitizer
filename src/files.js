import { constants } from 'node:fs';
import { open, rename, unlink, lstat, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { failure } from './detection.js';
import { decodeLogBytes, encodeLogText } from './log-bytes.js';

// UTF-16 text (Windows logs, PowerShell transcripts) is recognised only by its
// byte order mark; BOM-less UTF-16 remains binary input.
export function textEncoding(bytes) {
  if (bytes.length >= 2 && bytes.length % 2 === 0) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return 'utf-16le';
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return 'utf-16be';
    }
  }
  return 'utf-8';
}

function decodeWith(encoding, bytes) {
  try {
    return new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(
      bytes
    );
  } catch {
    throw failure('ERR_ENCODING');
  }
}

// Returns the decoded text and the encoding needed to write it back.
export function decodeTextInput(
  bytes,
  { lossless = false, allowBinary = false } = {}
) {
  if (typeof allowBinary !== 'boolean') {
    throw failure('ERR_CONFIG');
  }
  const encoding = textEncoding(bytes);
  if (encoding !== 'utf-8') {
    return { text: decodeWith(encoding, bytes), encoding };
  }
  if (!allowBinary && bytes.includes(0)) {
    throw failure('ERR_BINARY');
  }
  return {
    text: lossless ? decodeLogBytes(bytes) : decodeWith('utf-8', bytes),
    encoding,
  };
}

export function decodeText(bytes, options) {
  return decodeTextInput(bytes, options).text;
}

// Encode output in the input encoding; UTF-16 keeps its byte order mark
// because the decoded text retains it.
export function encodeTextOutput(text, encoding = 'utf-8') {
  if (encoding === 'utf-8') {
    return encodeLogText(text);
  }
  const bytes = Buffer.from(text, 'utf16le');
  return encoding === 'utf-16be' ? bytes.swap16() : bytes;
}

export async function readTextFile(path, maxBytes = 10 * 1024 * 1024, options) {
  return (await readTextInput(path, maxBytes, options)).text;
}

export async function readTextInput(
  path,
  maxBytes = 10 * 1024 * 1024,
  options
) {
  let handle;
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) {
      throw failure('ERR_FILE');
    }
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size > maxBytes) {
      throw failure('ERR_LIMIT');
    }
    const bytes = Buffer.alloc(Math.min(opened.size + 1, maxBytes + 1));
    let read = 0;
    while (read < bytes.length) {
      const part = await handle.read(bytes, read, bytes.length - read, null);
      if (!part.bytesRead) {
        break;
      }
      read += part.bytesRead;
    }
    if (read > maxBytes || read > opened.size) {
      throw failure('ERR_LIMIT');
    }
    return decodeTextInput(bytes.subarray(0, read), options);
  } catch (error) {
    if (error.code?.startsWith('ERR_')) {
      throw error;
    }
    throw failure('ERR_FILE');
  } finally {
    await handle?.close();
  }
}

export async function atomicWrite(path, text, { replace = false } = {}) {
  const target = resolve(path),
    temporary = join(dirname(target), `.sanitizer-${randomUUID()}.tmp`);
  let handle;
  try {
    try {
      const info = await lstat(target);
      if (!replace || !info.isFile() || info.isSymbolicLink()) {
        throw failure('ERR_OUTPUT');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    if (replace) {
      await rename(temporary, target);
    } else {
      // link() provides an atomic no-clobber publication; rename() alone
      // would silently overwrite a file created between the checks above.
      const { link } = await import('node:fs/promises');
      await link(temporary, target);
      await unlink(temporary);
    }
  } catch {
    throw failure('ERR_OUTPUT');
  } finally {
    await handle?.close();
    await unlink(temporary).catch(() => {});
  }
}

export async function listTextCandidates(root, maxFiles = 10000) {
  const files = [];
  async function visit(path) {
    const info = await lstat(path);
    if (info.isSymbolicLink()) {
      throw failure('ERR_FILE');
    }
    if (info.isFile()) {
      files.push(path);
      if (files.length > maxFiles) {
        throw failure('ERR_LIMIT');
      }
      return;
    }
    if (!info.isDirectory()) {
      throw failure('ERR_FILE');
    }
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (['.git', 'node_modules'].includes(entry.name)) {
        continue;
      }
      await visit(join(path, entry.name));
    }
  }
  try {
    await visit(root);
  } catch (error) {
    if (error.code?.startsWith('ERR_')) {
      throw error;
    }
    throw failure('ERR_FILE');
  }
  return files;
}
