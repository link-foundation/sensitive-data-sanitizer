import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, it } from 'test-anywhere';
import remove from '../examples/universal-app/compat/temp-rimraf/index.cjs';

describe('temp cleanup native adapter', () => {
  it('keeps local override metadata complete for npm ci in container jobs', async () => {
    const root = 'examples/universal-app/';
    const lock = JSON.parse(await readFile(`${root}package-lock.json`, 'utf8'));
    const manifest = JSON.parse(
      await readFile(`${root}compat/temp-rimraf/package.json`, 'utf8')
    );
    const entry = lock.packages['compat/temp-rimraf'];
    assert.equal(entry.name, manifest.name);
    assert.equal(entry.version, manifest.version);
    const link = lock.packages['node_modules/temp/node_modules/rimraf'];
    assert.equal(link.link, true);
    assert.equal(link.resolved, 'compat/temp-rimraf');
  });

  it('supports callback and synchronous recursive cleanup of literal paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'temp-cleanup-'));
    try {
      for (const name of ['literal[1]', 'literal1', 'sync']) {
        await mkdir(join(root, name, 'nested'), { recursive: true });
        await writeFile(join(root, name, 'nested/file'), name);
      }
      await promisify(remove)(join(root, 'literal[1]'), { maxBusyTries: 6 });
      await assert.rejects(readFile(join(root, 'literal[1]/nested/file')), {
        code: 'ENOENT',
      });
      assert.equal(
        await readFile(join(root, 'literal1/nested/file'), 'utf8'),
        'literal1'
      );
      remove.sync(join(root, 'sync'), { maxBusyTries: 6 });
      await assert.rejects(readFile(join(root, 'sync/nested/file')), {
        code: 'ENOENT',
      });
      await promisify(remove)(join(root, 'missing'));
      remove.sync(join(root, 'missing'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not follow cleanup symlinks into another owned fixture', async () => {
    const root = await mkdtemp(join(tmpdir(), 'temp-cleanup-link-'));
    try {
      const target = join(root, 'target');
      await mkdir(target);
      await writeFile(join(target, 'keep'), 'retained');
      await symlink(target, join(root, 'link'), 'junction');
      await promisify(remove)(join(root, 'link'), { maxBusyTries: 6 });
      assert.equal(await readFile(join(target, 'keep'), 'utf8'), 'retained');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('refuses unsupported options and invalid retry counts before deletion', () => {
    for (const options of [
      { glob: true },
      { maxBusyTries: -1 },
      { maxBusyTries: 1.5 },
    ]) {
      assert.throws(() => remove.sync('unused', options), TypeError);
      assert.throws(() => remove('unused', options, () => {}), TypeError);
    }
  });
});
