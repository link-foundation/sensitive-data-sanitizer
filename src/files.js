import { constants } from 'node:fs';
import { open, rename, unlink, lstat, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { failure } from './detection.js';

export function decodeText(bytes) {
  if (bytes.includes(0)) {
    throw failure('ERR_BINARY');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      bytes
    );
  } catch {
    throw failure('ERR_ENCODING');
  }
}

export async function readTextFile(path, maxBytes = 10 * 1024 * 1024) {
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
    return decodeText(bytes.subarray(0, read));
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
