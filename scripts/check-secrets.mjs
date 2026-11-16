#!/usr/bin/env node
// `secretlint "**/*"` walks the working tree through .gitignore and reads
// compressed bytes as opaque text. This scan covers the tracked files it
// misses: gzip and tar.gz evidence, other archive formats it cannot decode
// (rejected), and tracked files that .gitignore matches. Git is the
// inventory, .secretlintignore applies to every file through secretlint's own
// walker, and no archive is extracted to disk.
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

export const MAX_DECOMPRESSED_BYTES = 128 * 1024 * 1024;
const isCompressed = (name) => /\.(gz|tgz)$/i.test(name);
const isTarball = (name) => /\.(tar\.gz|tgz)$/i.test(name);
const isUnsupportedArchive = (name) =>
  /\.(tar|zip|bz2|tbz2?|xz|txz|zst|lz4|lzma|br|7z|rar)$/i.test(name);
const field = (block, start, length) =>
  block
    .subarray(start, start + length)
    .toString('utf8')
    .replace(/\0.*$/s, '');
function octal(value) {
  const text = value.replace(/\0.*$/s, '').trim();
  if (!/^[0-7]+$/.test(text)) {
    throw new Error('Invalid tar numeric field');
  }
  return Number.parseInt(text, 8);
}

function paxPath(content, type) {
  let name;
  for (let position = 0; position < content.length;) {
    const space = content.indexOf(32, position);
    const text = content.subarray(position, space).toString();
    const length = Number(text);
    if (
      space < position ||
      !/^[0-9]+$/.test(text) ||
      !Number.isSafeInteger(length) ||
      length <= space - position + 1 ||
      position + length > content.length ||
      content[position + length - 1] !== 10
    ) {
      throw new Error('Malformed PAX record');
    }
    const record = content
      .subarray(space + 1, position + length - 1)
      .toString('utf8');
    // Size and sparse overrides change which bytes the reader scans.
    if (
      !/^(?:path|linkpath|mtime|atime|ctime|uid|gid|uname|gname|comment|charset)=/.test(
        record
      )
    ) {
      throw new Error('Unsupported PAX record');
    }
    if (record.startsWith('path=')) {
      if (type === 'g') {
        throw new Error('Unsupported global PAX path');
      }
      name = record.slice(5);
    }
    position += length;
  }
  return name;
}

function tarHeader(tar, offset, nextName) {
  if (offset + 1024 > tar.length) {
    throw new Error('Truncated tar archive');
  }
  const header = tar.subarray(offset, offset + 512);
  if (!header.every((byte) => byte === 0)) {
    return header;
  }
  if (
    nextName !== undefined ||
    !tar.subarray(offset).every((byte) => byte === 0)
  ) {
    throw new Error('Invalid tar terminator or orphan metadata');
  }
  return null;
}

// ustar and GNU/PAX metadata are scanned as well as regular file contents.
// Unsupported formats fail closed.
export function readTarEntries(tar) {
  const entries = [];
  let nextName;
  for (let offset = 0; ;) {
    if (entries.length >= 10000) {
      throw new Error('Tar entry count limit exceeded');
    }
    const header = tarHeader(tar, offset, nextName);
    if (!header) {
      return entries;
    }
    const checksum = header.reduce(
      (sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte),
      0
    );
    if (checksum !== octal(field(header, 148, 8))) {
      throw new Error('Invalid tar checksum');
    }
    const size = octal(field(header, 124, 12));
    const end = offset + 512 + Math.ceil(size / 512) * 512;
    if (!Number.isSafeInteger(size) || end > tar.length) {
      throw new Error('Truncated tar entry');
    }
    const type = String.fromCharCode(header[156] || 48);
    if (!['0', '1', '2', '5', '7', 'x', 'g', 'L', 'K'].includes(type)) {
      throw new Error(`Unsupported tar entry type ${JSON.stringify(type)}`);
    }
    const prefix = field(header, 345, 155);
    const name =
      nextName ?? (prefix ? `${prefix}/` : '') + field(header, 0, 100);
    nextName = undefined;
    const content = tar.subarray(offset + 512, offset + 512 + size);
    if (type === 'L') {
      nextName = content.toString('utf8').replace(/\0.*$/s, '');
    } else if (type === 'x' || type === 'g') {
      nextName = paxPath(content, type);
    }
    // A plain-text suffix keeps filename-specific rules from skipping metadata.
    entries.push({
      name: ['0', '7'].includes(type) ? name : `${name}.metadata.txt`,
      content,
    });
    offset = end;
  }
}

export function scanCompressed(
  name,
  bytes,
  scan,
  budget = { remaining: MAX_DECOMPRESSED_BYTES },
  depth = 0
) {
  if (
    depth > 3 ||
    bytes.length > MAX_DECOMPRESSED_BYTES ||
    budget.remaining <= 0
  ) {
    throw new Error('Archive size or nesting limit exceeded');
  }
  const inflated = gunzipSync(bytes, { maxOutputLength: budget.remaining });
  budget.remaining -= inflated.length;
  if (isTarball(name)) {
    for (const entry of readTarEntries(inflated)) {
      scanMember(`${name}/${entry.name}`, entry.content, scan, budget, depth);
    }
  } else {
    scanMember(name.slice(0, -3), inflated, scan, budget, depth);
  }
}

// Members are judged by name like tracked files: gzip is unpacked, other
// archive formats (zip, plain tar, xz, ...) would hide their contents.
function scanMember(name, content, scan, budget, depth) {
  if (isUnsupportedArchive(name)) {
    throw new Error(`Cannot scan nested archive format of ${name}`);
  }
  if (isCompressed(name)) {
    scanCompressed(name, content, scan, budget, depth + 1);
  } else {
    scan(name, content);
  }
}

function gitFiles(cwd, args) {
  return execFileSync('git', ['ls-files', '-z', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean);
}

async function lint(cwd, cliOptions) {
  const { runSecretLint } = await import('secretlint');
  const { stdout } = await runSecretLint({
    cliOptions: { cwd, ...cliOptions },
    engineOptions: { cwd, formatter: 'json', color: false, maskSecrets: true },
  });
  return JSON.parse(stdout);
}

const findingsOf = (results, file) =>
  results.flatMap((result) =>
    result.messages.map((message) => ({
      file,
      line: message.loc.start.line,
      ruleId: message.ruleId,
      message: message.message,
    }))
  );

/**
 * Scan the tracked files that `secretlint "**\/*"` cannot read.
 * @param {{ cwd?: string, maxBytes?: number }} [options] maxBytes caps both
 *   the size of each archive and the bytes it inflates to.
 * @returns {Promise<{ checked: number, findings: object[] }>} findings are
 *   masked; corrupt, oversized and unsupported archives throw.
 */
export async function checkSecrets({
  cwd = process.cwd(),
  maxBytes = MAX_DECOMPRESSED_BYTES,
} = {}) {
  const tracked = gitFiles(cwd, []);
  if (!tracked.length) {
    throw new Error('No tracked files; secrets scan did not run');
  }
  const gitignored = new Set(
    gitFiles(cwd, ['--cached', '--ignored', '--exclude-standard'])
  );
  const targets = tracked.filter(
    (file) =>
      (isCompressed(file) ||
        isUnsupportedArchive(file) ||
        gitignored.has(file)) &&
      lstatSync(resolve(cwd, file)).isFile()
  );
  if (!targets.length) {
    return { checked: 0, findings: [] };
  }
  // The walker drops .secretlintignore matches; every other target is listed.
  const results = await lint(cwd, {
    filePathOrGlobList: targets,
    noGlob: true,
    respectGitignore: false,
  });
  const findings = [];
  const scanned = results.map((result) => {
    const file = relative(cwd, result.filePath).replaceAll('\\', '/');
    if (!isCompressed(file)) {
      findings.push(...findingsOf([result], file));
    }
    return file;
  });
  const unsupported = scanned.filter(isUnsupportedArchive);
  if (unsupported.length) {
    throw new Error(
      `Cannot scan archive format of ${unsupported.join(', ')}; add a gzip copy or a .secretlintignore entry`
    );
  }
  for (const file of scanned.filter(isCompressed)) {
    if (process.env.CI_SCRIPTS_DEBUG === '1') {
      console.error(`Scanning compressed evidence ${JSON.stringify(file)}`);
    }
    const members = [];
    try {
      if (lstatSync(resolve(cwd, file)).size > maxBytes) {
        throw new Error('Compressed file exceeds scan size limit');
      }
      const bytes = readFileSync(resolve(cwd, file));
      scanCompressed(
        file,
        bytes,
        (name, content) => members.push([name, content]),
        { remaining: maxBytes }
      );
    } catch (error) {
      throw new Error(`${file}: ${error.message}`, { cause: error });
    }
    for (const [name, content] of members) {
      const memberResults = await lint(cwd, {
        stdinFileName: name,
        stdinContent: content.toString('utf8'),
      });
      findings.push(...findingsOf(memberResults, name));
    }
  }
  return { checked: scanned.length, findings };
}

const annotationSafe = (value) =>
  JSON.stringify(value).replaceAll('::', '\\u003a\\u003a');

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const { checked, findings } = await checkSecrets();
    for (const finding of findings) {
      console.error(annotationSafe(finding));
    }
    if (findings.length) {
      console.error(`Secrets scan: ${findings.length} finding(s)`);
      process.exitCode = 1;
    } else {
      console.log(
        `Secrets scan: ${checked} compressed or git-ignored tracked files checked`
      );
    }
  } catch (error) {
    console.error(annotationSafe(String(error.message)));
    process.exitCode = 1;
  }
}
