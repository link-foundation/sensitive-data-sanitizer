#!/usr/bin/env node

/**
 * Lint entry point used by `npm run lint`.
 *
 * All files are linted for errors. Warnings are reported only in files that
 * the current branch changes relative to its base, keeping each run focused on
 * actionable findings; a change to the ESLint configuration, its local rules
 * or the package manifests reports every warning. Every reported error or
 * warning fails the run. Set LINT_ALL_WARNINGS=1 to report every warning, as
 * pushes to main do. Set LINT_VERBOSE=1 to list the base and changed files.
 */

import { execFileSync } from 'node:child_process';
import { ESLint } from 'eslint';
import {
  changesLintConfig,
  filterWarningsToChangedFiles,
  lintExitCode,
  parseChangedFiles,
} from './lint-changed-files.mjs';

const verbose = process.env.LINT_VERBOSE === '1';

function trace(message) {
  if (verbose) {
    console.error(`[lint] ${message}`);
  }
}

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function resolveBaseRef() {
  const baseRef = process.env.LINT_BASE_REF || process.env.GITHUB_BASE_REF;
  const candidates = baseRef
    ? [baseRef, `origin/${baseRef}`]
    : ['origin/main', 'main', 'origin/master', 'master'];

  for (const candidate of candidates) {
    try {
      git(['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`]);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

function collectChangedFiles() {
  const base = resolveBaseRef();

  if (!base) {
    trace('no base ref found; reporting every warning');
    return null;
  }

  try {
    const mergeBase = git(['merge-base', 'HEAD', base]).trim();
    const changed = parseChangedFiles(
      [
        git(['diff', '--name-only', mergeBase, '--']),
        git(['diff', '--name-only', 'HEAD', '--']),
        git(['ls-files', '--others', '--exclude-standard']),
      ].join('\n')
    );
    trace(`base ${base} (${mergeBase}); changed: ${[...changed].join(', ')}`);
    return changed;
  } catch (error) {
    trace(`could not diff against ${base}: ${error.message}`);
    return null;
  }
}

function selectChangedFiles() {
  if (process.env.LINT_ALL_WARNINGS === '1') {
    return null;
  }
  const changed = collectChangedFiles();
  if (changed && changesLintConfig(changed)) {
    console.log(
      'The lint configuration or package manifests changed; reporting every warning.'
    );
    return null;
  }
  return changed;
}

async function main() {
  const eslint = new ESLint();
  const results = await eslint.lintFiles(['.']);
  const changedFiles = selectChangedFiles();

  const reported = changedFiles
    ? filterWarningsToChangedFiles(results, changedFiles, process.cwd())
    : results;

  const formatter = await eslint.loadFormatter('stylish');
  const output = await formatter.format(reported);

  if (output) {
    console.log(output);
  }

  const hiddenWarnings =
    results.reduce((total, result) => total + result.warningCount, 0) -
    reported.reduce((total, result) => total + result.warningCount, 0);

  if (hiddenWarnings > 0) {
    console.log(
      `${hiddenWarnings} warning(s) in unchanged files were not reported. Run LINT_ALL_WARNINGS=1 npm run lint to see them.`
    );
  }

  process.exit(lintExitCode(reported));
}

await main();
