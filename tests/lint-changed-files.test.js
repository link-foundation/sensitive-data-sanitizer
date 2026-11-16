import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'test-anywhere';
import {
  changesLintConfig,
  filterWarningsToChangedFiles,
  lintExitCode,
  parseChangedFiles,
} from '../scripts/lint-changed-files.mjs';

function warning(line, ruleId = 'local/no-changelog-comments') {
  return { severity: 1, line, ruleId, message: 'warning' };
}

function lintResult(file, messages) {
  return {
    filePath: `/repo/${file}`,
    messages,
    errorCount: messages.filter((message) => message.severity === 2).length,
    warningCount: messages.filter((message) => message.severity === 1).length,
  };
}

describe('parseChangedFiles', () => {
  it('collects the paths of git diff --name-only and git ls-files', () => {
    const changed = parseChangedFiles('scripts/a.mjs\n\nscripts/b.mjs\n');

    expect([...changed]).toEqual(['scripts/a.mjs', 'scripts/b.mjs']);
  });
});

describe('filterWarningsToChangedFiles', () => {
  const cwd = '/repo';
  const changed = parseChangedFiles('scripts/example.mjs\n');

  it('keeps every warning of a changed file, on any line', () => {
    // complexity and max-lines-per-function report on the function head,
    // which an edit to the function body leaves unchanged.
    const [result] = filterWarningsToChangedFiles(
      [
        lintResult('scripts/example.mjs', [
          warning(1, 'complexity'),
          warning(44, 'max-lines-per-function'),
        ]),
      ],
      changed,
      cwd
    );

    expect(result.messages.map((message) => message.ruleId)).toEqual([
      'complexity',
      'max-lines-per-function',
    ]);
    expect(result.warningCount).toBe(2);
  });

  it('drops warnings from files that were not touched', () => {
    const [result] = filterWarningsToChangedFiles(
      [lintResult('scripts/other.mjs', [warning(1)])],
      changed,
      cwd
    );

    expect(result.messages.length).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('always keeps errors regardless of the diff', () => {
    const [result] = filterWarningsToChangedFiles(
      [
        lintResult('scripts/other.mjs', [
          { severity: 2, line: 5, ruleId: 'no-var' },
        ]),
      ],
      changed,
      cwd
    );

    expect(result.messages.length).toBe(1);
    expect(result.errorCount).toBe(1);
  });
});

describe('changesLintConfig', () => {
  it('reports every warning when the rules or their pins change', () => {
    for (const file of [
      'eslint.config.js',
      'eslint.config.mjs',
      'eslint-rules/no-changelog-comments.js',
      'package.json',
      'package-lock.json',
    ]) {
      expect(`${file} ${changesLintConfig(new Set([file]))}`).toBe(
        `${file} true`
      );
    }
  });

  it('keeps the changed-file filter for other changes', () => {
    expect(
      changesLintConfig(
        new Set(['scripts/lint.mjs', 'examples/universal-app/package.json'])
      )
    ).toBe(false);
  });
});

describe('lintExitCode', () => {
  const result = (errorCount, warningCount) => ({ errorCount, warningCount });

  it('passes only when nothing is reported', () => {
    expect(lintExitCode([result(0, 0), result(0, 0)])).toBe(0);
    expect(lintExitCode([])).toBe(0);
  });

  it('fails on a reported warning, as the pre-commit hook does', () => {
    expect(lintExitCode([result(0, 0), result(0, 1)])).toBe(1);
  });

  it('fails on an error', () => {
    expect(lintExitCode([result(1, 0)])).toBe(1);
  });

  it('reports every warning on pushes to main', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const step = workflow.split('- name: Run ESLint')[1].split('- name:')[0];
    expect(step).toContain("LINT_ALL_WARNINGS: '1'");
    expect(step).toContain('run: npm run lint');
  });
});

describe('eslint.config.js', () => {
  it('imports only packages that package.json declares', () => {
    // ESLint 9 hoisted @eslint/js, so an undeclared import still resolved;
    // ESLint 10 no longer depends on it.
    const config = readFileSync('eslint.config.js', 'utf8');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const declared = { ...pkg.dependencies, ...pkg.devDependencies };
    const imported = [...config.matchAll(/from '([^.][^']*)'/g)].map(
      ([, spec]) =>
        spec
          .split('/')
          .slice(0, spec.startsWith('@') ? 2 : 1)
          .join('/')
    );

    expect(imported).toContain('@eslint/js');
    for (const name of imported) {
      expect(`${name} ${typeof declared[name]}`).toBe(`${name} string`);
    }
  });
});
