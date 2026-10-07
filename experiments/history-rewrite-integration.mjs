/** Real git-filter-repo integration, entirely within a disposable local repo. */
import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rewriteGitHistory } from '../src/index.js';
const directory = await mkdtemp(
  join(tmpdir(), 'sanitizer-rewrite-integration-')
);
try {
  const source = join(directory, 'source');
  execFileSync('git', ['init', source], { stdio: 'ignore' });
  const git = (args) =>
    execFileSync('git', ['-C', source, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  git(['config', 'user.name', 'John Smith']);
  git(['config', 'user.email', 'john@private.example']);
  const filename = 'alice@private.example.txt';
  await writeFile(join(source, filename), 'Password: Tr0ub4dor&3\n');
  git(['add', '.']);
  git(['commit', '-m', 'Call John Smith']);
  git(['tag', '-a', 'v1', '-m', 'password: tag-secret']);
  git(['rm', filename]);
  git(['commit', '-m', 'Delete leaked text']);
  const head = git(['rev-parse', 'HEAD']);
  const result = await rewriteGitHistory(source, join(directory, 'clean'), {
    apply: true,
    filterRepoCommand: process.env.GIT_FILTER_REPO ?? 'git-filter-repo',
  });
  assert.equal(result.after.complete, true);
  assert.equal(result.after.findings.length, 0);
  assert.equal(result.changedPaths, 1);
  assert.equal(git(['rev-parse', 'HEAD']), head);
  assert.equal(
    execFileSync('git', ['-C', result.repository, 'remote'], {
      encoding: 'utf8',
    }),
    ''
  );
  assert.deepEqual((await readdir(join(directory, 'clean'))).sort(), [
    'manifest.json',
    'repository.git',
  ]);
  console.log(
    JSON.stringify({
      complete: true,
      scanned: result.after.scanned,
      changedPaths: result.changedPaths,
    })
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
