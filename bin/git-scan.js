import { TextDecoder } from 'node:util';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { realpath } from 'node:fs/promises';
import { execa } from 'command-stream/execa';
import { failure } from '../src/detection.js';
import { readFileBytes } from '../src/files.js';

const maxPaths = 10000;
const maxListingBytes = 8 * 1024 * 1024;

async function git(args, maxBuffer = maxListingBytes) {
  try {
    const result = await execa(
      'git',
      [
        '--no-replace-objects',
        '--literal-pathspecs',
        '-c',
        'core.fsmonitor=false',
        ...args,
      ],
      {
        env: { GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1' },
        encoding: 'buffer',
        stdin: 'ignore',
        stderr: 'ignore',
        stripFinalNewline: false,
        maxBuffer,
        timeout: 30000,
      }
    );
    return Buffer.from(
      result.stdout.buffer,
      result.stdout.byteOffset,
      result.stdout.byteLength
    );
  } catch (error) {
    throw failure(error.isMaxBuffer ? 'ERR_LIMIT' : 'ERR_GIT');
  }
}

function gitRecords(bytes) {
  try {
    const text = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
    if (text && !text.endsWith('\0')) {
      throw failure('ERR_GIT');
    }
    return text ? text.slice(0, -1).split('\0') : [];
  } catch {
    throw failure('ERR_GIT');
  }
}

function stagedFiles(records) {
  return records
    .filter((_, index) => index % 2 === 0)
    .map((record, index) => {
      const path = records[index * 2 + 1];
      const match =
        /^:\d{6} (\d{6}) [a-f0-9]+ ([a-f0-9]{40}|[a-f0-9]{64}) [ACMRTU]$/.exec(
          record
        );
      if (!match || !path) {
        throw failure('ERR_GIT');
      }
      const [, mode, object] = match;
      return {
        path,
        read(maxBytes) {
          if (!['100644', '100755', '120000'].includes(mode)) {
            throw failure('ERR_GIT_ENTRY');
          }
          return git(['cat-file', 'blob', object], maxBytes);
        },
      };
    });
}

function visibleFiles(records, directory) {
  return [...new Set(records)].map((path) => ({
    path,
    async read(maxBytes) {
      const target = resolve(directory, path);
      const under = relative(directory, target);
      if (
        under === '..' ||
        under.startsWith(`..${sep}`) ||
        isAbsolute(under) ||
        (await realpath(target).catch(() => null)) !== target
      ) {
        throw failure('ERR_GIT_ENTRY');
      }
      try {
        return await readFileBytes(target, maxBytes);
      } catch (error) {
        if (error.code === 'ERR_FILE') {
          throw failure('ERR_GIT_ENTRY');
        }
        throw error;
      }
    },
  }));
}

export async function gitScanFiles(config) {
  const specs = config.paths;
  const records = gitRecords(
    await git(
      config.staged
        ? [
            'diff',
            '--cached',
            '--raw',
            '-z',
            '--no-abbrev',
            '--relative',
            '--no-renames',
            '--no-ext-diff',
            '--no-textconv',
            '--diff-filter=ACMRTU',
            '--',
            ...specs,
          ]
        : [
            'ls-files',
            '-z',
            '--cached',
            '--others',
            '--exclude-standard',
            '--deduplicate',
            '--',
            ...specs,
          ]
    )
  );
  if (records.length > maxPaths * (config.staged ? 2 : 1)) {
    throw failure('ERR_LIMIT');
  }
  return config.staged
    ? stagedFiles(records)
    : visibleFiles(records, await realpath(process.cwd()));
}
