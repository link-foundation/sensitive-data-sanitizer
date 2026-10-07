import { describe, it, expect } from 'test-anywhere';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rewriteGitHistory } from '../src/index.js';
async function repository(directory) {
  const source = join(directory, 'source');
  execFileSync('git', ['init', source], { stdio: 'ignore' });
  const git = (args) =>
    execFileSync('git', ['-C', source, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  git(['config', 'user.name', 'John Smith']);
  git(['config', 'user.email', 'john@private.example']);
  await writeFile(join(source, 'private.txt'), 'Password: Tr0ub4dor&3\n');
  git(['add', '.']);
  git(['commit', '-m', 'contact John Smith']);
  git(['tag', '-a', 'v1', '-m', 'password: tag-secret']);
  git(['rm', 'private.txt']);
  git(['commit', '-m', 'Delete leaked text']);
  return { source, git };
}
describe('fresh-clone history remediation', () => {
  it('previews private replacements and mailmap without editing the source or pushing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sanitizer-history-'));
    try {
      const { source, git } = await repository(directory),
        before = git(['rev-parse', 'HEAD']);
      const result = await rewriteGitHistory(
        source,
        join(directory, 'preview'),
        { sanitizerOptions: { secretlint: false } }
      );
      expect(result.applied).toBe(false);
      expect(result.before.findings.length > 0).toBe(true);
      expect(git(['rev-parse', 'HEAD'])).toBe(before);
      expect(
        (
          await readFile(join(directory, 'preview', 'mailmap'), 'utf8')
        ).includes('john@private.example')
      ).toBe(true);
      expect(
        execFileSync('git', ['-C', result.repository, 'remote'], {
          encoding: 'utf8',
        })
      ).toBe('');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('fails closed for missing rewrite tools and pre-existing destinations', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sanitizer-history-'));
    try {
      const { source } = await repository(directory);
      let blocked = false;
      try {
        await rewriteGitHistory(source, join(directory, 'apply'), {
          apply: true,
          filterRepoCommand: '/missing/filter-repo',
          sanitizerOptions: { secretlint: false },
        });
      } catch (e) {
        blocked = e.code === 'ERR_HISTORY_REWRITE';
      }
      expect(blocked).toBe(true);
      blocked = false;
      try {
        await rewriteGitHistory(source, source);
      } catch {
        blocked = true;
      }
      expect(blocked).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
