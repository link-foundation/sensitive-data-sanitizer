/**
 * Helpers for reporting ESLint warnings only in changed files.
 *
 * Errors are always reported, everywhere. Warnings are noise when they come
 * from untouched files: every run repeats the same findings and hides the new
 * ones. A changed file keeps all of its warnings, because rules such as
 * `complexity` and `max-lines-per-function` report on a function's first
 * line, which an edit to the function body leaves unchanged. This is also the
 * scope of the pre-commit hook: lint-staged lints whole staged files with
 * `--max-warnings 0`.
 */

import path from 'node:path';

/**
 * Files whose change can alter the warnings of any other file: the ESLint
 * configuration, the local rules it loads, and the manifests that pin ESLint
 * and its plugins.
 */
const LINT_CONFIG_FILE =
  /^(?:eslint\.config\.[cm]?js|eslint-rules\/.+|package(?:-lock)?\.json)$/;

/**
 * Parse `git diff --name-only` (or `git ls-files`) output into a set of
 * repository-relative paths.
 *
 * @param {string} text newline-separated paths
 * @returns {Set<string>}
 */
export function parseChangedFiles(text) {
  return new Set(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

/**
 * Whether a change can move warnings in files the branch did not touch, so
 * every warning has to be reported.
 *
 * @param {Set<string>} changedFiles from {@link parseChangedFiles}
 * @returns {boolean}
 */
export function changesLintConfig(changedFiles) {
  return [...changedFiles].some((file) => LINT_CONFIG_FILE.test(file));
}

function relativePath(filePath, cwd) {
  return path.relative(cwd, filePath).split(path.sep).join('/');
}

/**
 * Keep every error, and keep warnings only in changed files.
 *
 * @param {Array<object>} results ESLint result objects
 * @param {Set<string>} changedFiles repository-relative paths
 * @param {string} cwd directory the result paths are relative to
 * @returns {Array<object>} filtered ESLint results
 */
export function filterWarningsToChangedFiles(results, changedFiles, cwd) {
  return results.map((result) => {
    const changed = changedFiles.has(relativePath(result.filePath, cwd));
    const messages = result.messages.filter(
      (message) => message.severity !== 1 || changed
    );

    return {
      ...result,
      messages,
      warningCount: messages.filter((message) => message.severity === 1).length,
      fixableWarningCount: messages.filter(
        (message) => message.severity === 1 && message.fix
      ).length,
    };
  });
}

/**
 * Exit code for the reported results: any error or any reported warning
 * fails. The pre-commit hook runs ESLint with --max-warnings 0, so CI rejects
 * what a skipped hook would have rejected.
 *
 * @param {Array<object>} reported ESLint results after filtering
 * @returns {0 | 1}
 */
export function lintExitCode(reported) {
  return reported.some((result) => result.errorCount + result.warningCount > 0)
    ? 1
    : 0;
}
