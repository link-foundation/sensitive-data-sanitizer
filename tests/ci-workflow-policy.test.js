import { describe, it, expect } from 'test-anywhere';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkSelfRepositoryPolicy,
  checkWorkflowPolicy,
} from '../scripts/check-ci-workflows.mjs';

function readWorkflowTree() {
  const files = {};
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules') {
        continue;
      }
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (/\.ya?ml$/.test(path)) {
        files[path] = readFileSync(path, 'utf8');
      }
    }
  };
  walk('.github/workflows');
  walk('.github/actions');
  return files;
}

describe('workflow policy regression protection', () => {
  for (const spec of [
    'secretlint',
    '@secretlint/preset',
    'secretlint@latest',
    'secretlint@^13.0.7',
  ]) {
    for (const option of ['-p ', '--package=']) {
      it(`rejects unpinned package ${option}${spec}`, () => {
        expect(
          checkWorkflowPolicy(`run: npx --yes ${option}${spec} scan`).length
        ).toBeGreaterThan(0);
      });
    }
  }
  it('checks every package option and a continued shell command', () => {
    expect(
      checkWorkflowPolicy('run: npx -p good@1.2.3 -p bad scan').length
    ).toBe(1);
    expect(
      checkWorkflowPolicy('run: npx -p good@1.2.3 \\\n  --package bad scan')
        .length
    ).toBe(1);
    expect(
      checkWorkflowPolicy(
        'run: npx -p secretlint@13.0.7 -p @secretlint/preset@13.0.7 scan'
      )
    ).toEqual([]);
  });
  it('rejects floating matrix and direct runner labels but ignores comments', () => {
    expect(
      checkWorkflowPolicy('os: [ubuntu-24.04, macos-latest, windows-latest]')
        .length
    ).toBe(1);
    expect(checkWorkflowPolicy('runs-on: ubuntu-latest').length).toBe(1);
    expect(
      checkWorkflowPolicy('# runs-on: ubuntu-latest\nruns-on: macos-15')
    ).toEqual([]);
  });
  it('rejects zizmor version drift and versions unsupported by the pinned action', () => {
    const workflow =
      'uses: zizmorcore/zizmor-action@v0.8.1\nwith:\n  version: 1.32.0\nrun: pipx run zizmor==1.32.0\n# pipx run zizmor==1.32.0';
    expect(checkWorkflowPolicy(workflow)).toEqual([]);
    expect(
      checkWorkflowPolicy(workflow.replace('zizmor==1.32.0', 'zizmor==1.29.0'))
        .length
    ).toBeGreaterThan(0);
    expect(
      checkWorkflowPolicy(workflow.replaceAll('1.32.0', '9.0.0')).length
    ).toBeGreaterThan(0);
  });
});

describe('self-repository action exception', () => {
  const files = readWorkflowTree();
  const config = readFileSync('.github/zizmor.yml', 'utf8');

  it('lists exactly the workflows and actions that call a local action', () => {
    expect(checkSelfRepositoryPolicy(files, config)).toEqual([]);
  });

  it('accepts Windows paths and CRLF configuration', () => {
    const windowsFiles = Object.fromEntries(
      Object.entries(files).map(([path, text]) => [
        path.replaceAll('/', '\\'),
        text,
      ])
    );
    expect(
      checkSelfRepositoryPolicy(windowsFiles, config.replace(/\r?\n/g, '\r\n'))
    ).toEqual([]);
  });

  it('accepts a tree with neither local actions nor an exception', () => {
    expect(checkSelfRepositoryPolicy({}, '')).toEqual([]);
  });

  it('rejects a local action user missing from the exception', () => {
    const errors = checkSelfRepositoryPolicy(
      {
        ...files,
        '.github/workflows/new.yml':
          'steps:\n  - uses: ./.github/actions/setup-node\n',
      },
      config
    );
    expect(errors).toEqual([
      'Unlisted self-repository action user: .github/workflows/new.yml',
    ]);
    expect(checkSelfRepositoryPolicy(files, '').length).toBeGreaterThan(0);
  });

  it('rejects an exception entry for a file without a local action', () => {
    expect(
      checkSelfRepositoryPolicy(
        files,
        `${config.trimEnd()}\n      - stale.yml\n`
      )
    ).toEqual(['Unused or broad self-repository exception: stale.yml']);
    expect(
      checkSelfRepositoryPolicy(files, `${config.trimEnd()}\n      - "*.yml"\n`)
        .length
    ).toBeGreaterThan(0);
  });
});
