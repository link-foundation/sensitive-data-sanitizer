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
  } = {}
) {
  sanitizer ??= createSanitizer();
  validateLimits([maxObjects, maxBytes, maxTotalBytes]);
  const git = (args, input) => {
    try {
      return execFileSync('git', ['-C', repository, ...args], {
        input,
        maxBuffer: Math.max(maxBytes + 1024, 4 * 1024 * 1024),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      throw failure('ERR_GIT');
    }
  };
  const objects = new Set(
    git(['rev-list', '--objects', '--all', '--reflog'])
      .toString('utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split(' ')[0])
  );
  if (objects.size > maxObjects) {
    throw failure('ERR_LIMIT');
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
