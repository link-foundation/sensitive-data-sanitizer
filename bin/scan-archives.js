import { promisify } from 'node:util';
import { crc32, gunzip } from 'node:zlib';
import { failure } from '../src/detection.js';

const unzipGzip = promisify(gunzip);

function archiveType(name, bytes) {
  if (
    /\.zip$/i.test(name) ||
    (bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      ((bytes[2] === 3 && bytes[3] === 4) ||
        (bytes[2] === 5 && bytes[3] === 6)))
  ) {
    return 'zip';
  }
  if (/\.(gz|tgz)$/i.test(name) || (bytes[0] === 0x1f && bytes[1] === 0x8b)) {
    return 'gzip';
  }
  if (/\.tar$/i.test(name) || bytes.toString('ascii', 257, 262) === 'ustar') {
    return 'tar';
  }
  return undefined;
}

function checkMember(name, names, budget) {
  if (--budget.entries < 0) {
    throw failure('ERR_LIMIT');
  }
  if (
    !name ||
    name.startsWith('/') ||
    name.includes('\\') ||
    /^[a-z]:/i.test(name) ||
    name.includes('\0') ||
    name.split('/').includes('..') ||
    names.has(name)
  ) {
    throw failure('ERR_ARCHIVE');
  }
  names.add(name);
}

async function memberBytes(stream, size, budget) {
  if (!Number.isSafeInteger(size) || size < 0 || size > budget.bytes) {
    throw failure('ERR_LIMIT');
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of stream) {
    length += chunk.length;
    if (length > size) {
      throw failure('ERR_ARCHIVE');
    }
    chunks.push(chunk);
  }
  if (length !== size) {
    throw failure('ERR_ARCHIVE');
  }
  budget.bytes -= length;
  return Buffer.concat(chunks, length);
}

async function* zipMembers(bytes, budget) {
  const { fromBufferPromise } = await import('yauzl');
  const zip = await fromBufferPromise(bytes, {
    lazyEntries: true,
    strictFileNames: true,
  });
  const names = new Set();
  try {
    for await (const entry of zip.eachEntry()) {
      const name = entry.fileName;
      checkMember(name, names, budget);
      if (name.endsWith('/') && entry.uncompressedSize === 0) {
        continue;
      }
      const type = (entry.externalFileAttributes >>> 16) & 0o170000;
      if (type !== 0 && type !== 0o100000) {
        yield { name, reason: 'ERR_ARCHIVE_ENTRY' };
        continue;
      }
      if (entry.uncompressedSize > budget.bytes) {
        throw failure('ERR_LIMIT');
      }
      const stream = await zip.openReadStreamPromise(entry);
      const body = await memberBytes(stream, entry.uncompressedSize, budget);
      if (crc32(body) !== entry.crc32) {
        throw failure('ERR_ARCHIVE');
      }
      yield { name, bytes: body };
    }
  } finally {
    zip.close();
  }
}

async function* tarMembers(bytes, budget) {
  const { extract } = await import('tar-stream');
  const tar = extract();
  const names = new Set();
  const entries = tar[Symbol.asyncIterator]();
  tar.end(bytes);
  try {
    for await (const entry of entries) {
      const { name, size, type } = entry.header;
      checkMember(name, names, budget);
      if (type === 'directory' && size === 0) {
        entry.resume();
      } else if (type === 'file' || type === 'contiguous-file') {
        yield { name, bytes: await memberBytes(entry, size, budget) };
      } else if (size === 0) {
        entry.resume();
        yield { name, reason: 'ERR_ARCHIVE_ENTRY' };
      } else {
        throw failure('ERR_ARCHIVE');
      }
    }
  } finally {
    tar.destroy();
  }
}

async function* gzipMembers(name, bytes, budget) {
  if (!budget.bytes || --budget.entries < 0) {
    throw failure('ERR_LIMIT');
  }
  const body = await unzipGzip(bytes, { maxOutputLength: budget.bytes });
  budget.bytes -= body.length;
  name = /\.tgz$/i.test(name)
    ? name.replace(/\.tgz$/i, '.tar')
    : name.replace(/\.gz$/i, '');
  yield { name: name || 'payload', bytes: body };
}

async function* walkArchive(path, name, bytes, depth, budget) {
  const type = archiveType(name, bytes);
  if (!type) {
    yield { path, bytes };
    return;
  }
  if (!depth) {
    yield { path, reason: 'ERR_ARCHIVE_DEPTH' };
    return;
  }
  try {
    const members =
      type === 'zip'
        ? zipMembers(bytes, budget)
        : type === 'tar'
          ? tarMembers(bytes, budget)
          : gzipMembers(name, bytes, budget);
    for await (const member of members) {
      const child = [...path, member.name];
      if (member.reason) {
        yield { path: child, reason: member.reason };
      } else {
        yield* walkArchive(child, member.name, member.bytes, depth - 1, budget);
      }
    }
  } catch (error) {
    yield {
      path,
      reason: ['ERR_LIMIT', 'ERR_BUFFER_TOO_LARGE'].includes(error.code)
        ? 'ERR_LIMIT'
        : 'ERR_ARCHIVE',
    };
  }
}

export function scanArchive(path, bytes, { archiveDepth, maxBytes }) {
  const name = path.split(/[/\\]/).at(-1);
  return walkArchive([path], name, bytes, archiveDepth, {
    bytes: maxBytes,
    entries: 10000,
  });
}
