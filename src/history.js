import { execFileSync } from 'node:child_process';
import { failure } from './detection.js';
import { decodeText } from './files.js';
import { createSanitizer } from './engines.js';

export async function auditGitHistory(
  repository,
  {
    sanitizer,
    maxObjects = 10000,
    maxBytes = 10 * 1024 * 1024,
    maxTotalBytes = 100 * 1024 * 1024,
    from,
    to,
    since,
    until,
  } = {}
) {
  sanitizer ??= createSanitizer();
  validateLimits([maxObjects, maxBytes, maxTotalBytes]);
  const git = (args, input) => {
    try {
      return execFileSync(
        'git',
        ['--no-replace-objects', '-C', repository, ...args],
        {
          env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
          input,
          maxBuffer: Math.max(maxBytes + 1024, 4 * 1024 * 1024),
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );
    } catch {
      throw failure('ERR_GIT');
    }
  };
  const objects = new Set(
    git([
      'rev-list',
      '--objects',
      '--no-object-names',
      ...historySelection(git, { from, to, since, until }),
      '--',
    ])
      .toString('utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
  );
  if (objects.size > maxObjects) {
    throw failure('ERR_LIMIT');
  }
  if (!objects.size) {
    return { scanned: 0, findings: [], skipped: [], complete: true };
  }
  const metadata = git(
    ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
    `${[...objects].join('\n')}\n`
  )
    .toString('utf8')
    .trim()
    .split('\n')
    .filter(Boolean);
  const findings = [],
    skipped = [];
  let scanned = 0,
    total = 0;
  for (const record of metadata) {
    const { object, type, size } = parseRecord(record);
    if (!['blob', 'commit', 'tag'].includes(type)) {
      continue;
    }
    total += size;
    if (size > maxBytes || total > maxTotalBytes) {
      throw failure('ERR_LIMIT');
    }
    const bytes = git(['cat-file', type, object]);
    const decoded = decodeObject(bytes);
    if (decoded.reason) {
      skipped.push({ object, reason: decoded.reason });
      continue;
    }
    const text = decoded.text;
    const detected = await sanitizer.inspect(text);
    scanned++;
    if (detected.length) {
      findings.push({ object, type, findings: detected });
    }
  }
  return { scanned, findings, skipped, complete: skipped.length === 0 };
}

function historyDate(date, endOfDay) {
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}Z)?$/.test(date)
  ) {
    throw failure('ERR_CONFIG');
  }
  const utc =
    date.length === 10
      ? `${date}T${endOfDay ? '23:59:59' : '00:00:00'}Z`
      : date;
  const value = new Date(utc);
  if (
    !Number.isFinite(value.getTime()) ||
    value.toISOString() !== utc.replace('Z', '.000Z')
  ) {
    throw failure('ERR_CONFIG');
  }
  return value.getTime() / 1000;
}

function historySelection(git, { from, to, since, until }) {
  const first = since === undefined ? undefined : historyDate(since, false);
  const last = until === undefined ? undefined : historyDate(until, true);
  if (first !== undefined && last !== undefined && first > last) {
    throw failure('ERR_CONFIG');
  }
  const selection = [];
  if (first !== undefined) {
    selection.push(`--since-as-filter=@${first}`);
  }
  if (last !== undefined) {
    selection.push(`--until=@${last}`);
  }
  if (from !== undefined || to !== undefined) {
    selection.push(commitId(git, to ?? 'HEAD'));
    if (from !== undefined) {
      selection.push(`^${commitId(git, from)}`);
    }
  } else {
    selection.push('--all', '--reflog');
  }
  return selection;
}

function commitId(git, ref) {
  if (typeof ref !== 'string' || !ref) {
    throw failure('ERR_CONFIG');
  }
  const id = git([
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${ref}^{commit}`,
  ])
    .toString('ascii')
    .trim();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(id)) {
    throw failure('ERR_GIT');
  }
  return id;
}

function parseRecord(record) {
  const [object, type, sizeText] = record.split(' ');
  const size = Number(sizeText);
  if (
    !/^[a-f0-9]{40,64}$/.test(object) ||
    !Number.isSafeInteger(size) ||
    size < 0
  ) {
    throw failure('ERR_GIT');
  }
  return { object, type, size };
}

function decodeObject(bytes) {
  try {
    return { text: decodeText(bytes) };
  } catch (error) {
    return { reason: error.code };
  }
}

function validateLimits(limits) {
  for (const limit of limits) {
    if (!Number.isSafeInteger(limit) || limit <= 0) {
      throw failure('ERR_CONFIG');
    }
  }
}
