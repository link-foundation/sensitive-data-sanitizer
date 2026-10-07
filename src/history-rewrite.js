import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, rm, chmod } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createSanitizer } from './engines.js';
import { auditGitHistory } from './history.js';
import { decodeText } from './files.js';
import { failure } from './detection.js';

function git(repository, args) {
  try {
    return execFileSync('git', ['-C', repository, ...args], {
      maxBuffer: 100 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw failure('ERR_GIT');
  }
}
async function identity(line, engine) {
  const match = /^(.*) <([^>]*)> (\d+ [+-]\d{4})$/.exec(line);
  if (!match) {
    throw failure('ERR_GIT');
  }
  const name = await engine.sanitize(match[1]),
    email = await engine.sanitize(match[2]);
  const date = (await engine.inspect(match[3])).length ? '0 +0000' : match[3];
  return {
    name: name.text,
    email: email.redactions ? 'REDACTED' : email.text,
    date,
    originalName: match[1],
    originalEmail: match[2],
  };
}
function regexp(value) {
  return value
    .replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r');
}
async function buildPlan(repository, audit, engine, maxPaths) {
  const data = { blobs: {}, commits: {}, tags: {}, paths: {}, refs: {} },
    replacements = new Set(),
    mailmap = new Set();
  for (const entry of audit.findings) {
    const text = decodeText(
      git(repository, ['cat-file', entry.type, entry.object])
    );
    for (const f of entry.findings) {
      const value = text.slice(f.start, f.end);
      replacements.add(
        `regex:${regexp(value).replaceAll('==>', '\\x3d\\x3d\\x3e')}==>[REDACTED]`
      );
    }
    if (entry.type === 'blob') {
      data.blobs[entry.object] = Buffer.from(
        (await engine.sanitize(text)).text
      ).toString('base64');
      continue;
    }
    const split = text.indexOf('\n\n');
    if (split < 0) {
      throw failure('ERR_GIT');
    }
    const details = {
      message: (await engine.sanitize(text.slice(split + 2))).text,
    };
    for (const field of entry.type === 'commit'
      ? ['author', 'committer']
      : ['tagger']) {
      const line = text
        .slice(0, split)
        .split('\n')
        .find((record) => record.startsWith(`${field} `));
      if (!line) {
        continue;
      }
      const person = await identity(line.slice(field.length + 1), engine);
      details[field] = {
        name: person.name,
        email: person.email,
        date: person.date,
      };
      if (
        person.name !== person.originalName ||
        person.email !== person.originalEmail
      ) {
        mailmap.add(
          `${person.name} <${person.email}> ${person.originalName} <${person.originalEmail}>`
        );
      }
    }
    data[entry.type === 'commit' ? 'commits' : 'tags'][entry.object] = details;
  }
  const paths = new Set();
  for (const commit of git(repository, ['rev-list', '--all'])
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean)) {
    for (const path of git(repository, [
      'ls-tree',
      '-r',
      '-z',
      '--name-only',
      commit,
    ])
      .toString('utf8')
      .split('\0')
      .filter(Boolean)) {
      paths.add(path);
      if (paths.size > maxPaths) {
        throw failure('ERR_LIMIT');
      }
    }
  }
  await pathMappings(paths, data.paths, engine, false);
  const refs = git(repository, ['for-each-ref', '--format=%(refname)'])
    .toString('utf8')
    .trim()
    .split('\n')
    .filter(Boolean);
  await pathMappings(refs, data.refs, engine, true);
  return {
    data,
    replacements: `${[...replacements].join('\n')}\n`,
    mailmap: `${[...mailmap].join('\n')}\n`,
  };
}
async function pathMappings(paths, mappings, engine, ref) {
  const targets = new Map();
  for (const path of paths) {
    const result = await engine.sanitize(path),
      replacement = ref
        ? result.text.replaceAll('[REDACTED]', 'REDACTED')
        : result.text;
    if (targets.has(replacement) && targets.get(replacement) !== path) {
      throw failure('ERR_HISTORY_COLLISION');
    }
    targets.set(replacement, path);
    if (result.redactions) {
      mappings[path] = replacement;
    }
  }
}
const callbacks = `import base64, json
from pathlib import Path
plan = json.loads(Path(__file__).with_name('replacements.json').read_text())
def blob(blob):
    value = plan['blobs'].get(blob.original_id.decode())
    if value is not None: blob.data = base64.b64decode(value)
def metadata(obj, group):
    value = plan[group].get(obj.original_id.decode())
    if value is None: return
    obj.message = value['message'].encode()
    for role in ('author', 'committer', 'tagger'):
        if role in value:
            for key in ('name', 'email', 'date'):
                setattr(obj, role + '_' + key, value[role][key].encode())
def filename(value):
    return plan['paths'].get(value.decode(), value.decode()).encode()
def refname(value):
    return plan['refs'].get(value.decode(), value.decode()).encode()
`;
/** Preview by default; --apply affects only the newly created mirror clone. */
export async function rewriteGitHistory(
  source,
  destination,
  {
    apply = false,
    sanitizer,
    sanitizerOptions = {},
    filterRepoCommand = 'git-filter-repo',
    maxPaths = 10000,
    ...auditOptions
  } = {}
) {
  validateRewriteOptions(apply, maxPaths, filterRepoCommand);
  const directory = resolve(destination),
    repository = join(directory, 'repository.git');
  sanitizer ??= createSanitizer(sanitizerOptions);
  try {
    await mkdir(directory, { mode: 0o700 });
  } catch {
    throw failure('ERR_OUTPUT');
  }
  try {
    execFileSync(
      'git',
      ['clone', '--mirror', '--no-local', '--', resolve(source), repository],
      { maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    await chmod(repository, 0o700);
    const before = await auditGitHistory(repository, {
      ...auditOptions,
      sanitizer,
    });
    if (!before.complete) {
      throw failure('ERR_HISTORY_INCOMPLETE');
    }
    const plan = await buildPlan(repository, before, sanitizer, maxPaths);
    for (const [name, content] of Object.entries({
      'replacements.json': JSON.stringify(plan.data),
      'replace-text.txt': plan.replacements,
      mailmap: plan.mailmap,
      'sanitizer_plan.py': callbacks,
    })) {
      await writeFile(join(directory, name), content, {
        flag: 'wx',
        mode: 0o600,
      });
    }
    if (apply) {
      runFilter(repository, directory, filterRepoCommand);
      return await completedRewrite(
        { repository, directory, before, plan },
        sanitizer,
        auditOptions,
        maxPaths
      );
    }
    git(repository, ['remote', 'remove', 'origin']);
    return {
      applied: false,
      repository,
      before,
      changedPaths: Object.keys(plan.data.paths).length,
      changedRefs: Object.keys(plan.data.refs).length,
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw failure(
      /^ERR_[A-Z_]+$/.test(error.code) ? error.code : 'ERR_HISTORY_REWRITE'
    );
  }
}
function runFilter(repository, directory, command) {
  try {
    execFileSync(
      command,
      [
        '--blob-callback',
        'import sanitizer_plan; sanitizer_plan.blob(blob)',
        '--commit-callback',
        "import sanitizer_plan; sanitizer_plan.metadata(commit, 'commits')",
        '--tag-callback',
        "import sanitizer_plan; sanitizer_plan.metadata(tag, 'tags')",
        '--filename-callback',
        'import sanitizer_plan; return sanitizer_plan.filename(filename)',
        '--refname-callback',
        'import sanitizer_plan; return sanitizer_plan.refname(refname)',
      ],
      {
        cwd: repository,
        env: { ...process.env, PYTHONPATH: directory },
        maxBuffer: 4 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
  } catch {
    throw failure('ERR_HISTORY_REWRITE');
  }
}
async function checkPaths(repository, sanitizer, maxPaths) {
  const plan = await buildPlan(
    repository,
    { findings: [] },
    sanitizer,
    maxPaths
  );
  if (
    Object.keys(plan.data.paths).length ||
    Object.keys(plan.data.refs).length
  ) {
    throw failure('ERR_HISTORY_RESIDUAL');
  }
}
async function removePrivatePlan(directory) {
  for (const name of [
    'replacements.json',
    'replace-text.txt',
    'mailmap',
    'sanitizer_plan.py',
    '__pycache__',
  ]) {
    await rm(join(directory, name), { recursive: true, force: true });
  }
  const config = await readFile(
    join(directory, 'repository.git', 'config'),
    'utf8'
  );
  if (config.includes('[remote "origin"]')) {
    git(join(directory, 'repository.git'), ['remote', 'remove', 'origin']);
  }
}

async function completedRewrite(
  { repository, directory, before, plan },
  sanitizer,
  auditOptions,
  maxPaths
) {
  const after = await auditGitHistory(repository, {
    ...auditOptions,
    sanitizer,
  });
  if (!after.complete || after.findings.length) {
    throw failure('ERR_HISTORY_RESIDUAL');
  }
  await checkPaths(repository, sanitizer, maxPaths);
  git(repository, ['fsck', '--full']);
  await removePrivatePlan(directory);
  const result = {
    applied: true,
    repository,
    before,
    after,
    changedPaths: Object.keys(plan.data.paths).length,
    changedRefs: Object.keys(plan.data.refs).length,
  };
  await writeFile(
    join(directory, 'manifest.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    { mode: 0o600 }
  );
  return result;
}

function validateRewriteOptions(apply, maxPaths, command) {
  if (
    typeof apply !== 'boolean' ||
    !Number.isSafeInteger(maxPaths) ||
    maxPaths <= 0 ||
    typeof command !== 'string' ||
    !command
  ) {
    throw failure('ERR_CONFIG');
  }
}
