#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Verified against the action tag's support/versions table, without network in CI:
// https://github.com/zizmorcore/zizmor-action/blob/v0.8.1/support/locks/zizmor-1.32.0.txt
const supportedZizmor = { 'v0.8.1': '1.32.0' };

/**
 * Explains an unverified action/CLI pair: a Dependabot bump of the action
 * lands here, so the message names both pins and the table to edit.
 *
 * @param {string} action zizmorcore/zizmor-action ref from the workflow.
 * @param {string | undefined} version zizmor CLI version from the workflow.
 * @returns {string}
 */
function zizmorSupportError(action, version) {
  const known = Object.entries(supportedZizmor)
    .map(([ref, cli]) => `zizmor-action@${ref} -> zizmor ${cli}`)
    .join(', ');
  return (
    `zizmorcore/zizmor-action@${action} is not verified for zizmor CLI ` +
    `${version ?? '(no version: input)'}. Check that ` +
    `https://github.com/zizmorcore/zizmor-action/tree/${action}/support ` +
    `lists that CLI version (support/locks or support/versions), then set ` +
    `the action's version: input and every zizmor== pin to it and record ` +
    `the pair in supportedZizmor in scripts/check-ci-workflows.mjs ` +
    `(verified: ${known}).`
  );
}

export function checkWorkflowPolicy(text) {
  const errors = [];
  const shellText = text.replace(/\\\r?\n\s*/g, ' ');
  for (const line of shellText.split('\n')) {
    const code = line.replace(/\s*#.*$/, '');
    if (/\b(?:ubuntu|windows|macos)-latest\b/.test(code)) {
      errors.push('Pin hosted runners to an explicit image');
    }
    if (/\bnpx\b/.test(code)) {
      for (const match of code.matchAll(
        /(?:\s)(?:-p|--package)(?:\s+|=)(\S+)/g
      )) {
        const spec = match[1].replace(/^['"]|['"]$/g, '');
        if (!/^(?:@[^/\s]+\/)?[^@\s]+@\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(spec)) {
          errors.push(`Pin npx package to an exact version: ${spec}`);
        }
      }
    }
  }
  const action = text.match(/zizmorcore\/zizmor-action@(\S+)/)?.[1];
  if (action) {
    const version = text
      .slice(text.indexOf('zizmorcore/zizmor-action@'))
      .match(/\bversion:\s*(\d+\.\d+\.\d+)/)?.[1];
    const cliVersions = Array.from(
      text.matchAll(/zizmor==(\d+\.\d+\.\d+)/g),
      (match) => match[1]
    );
    if (!version || cliVersions.some((cliVersion) => cliVersion !== version)) {
      errors.push(
        'Every zizmor pass and reproduction command must use the action version'
      );
    }
    if (supportedZizmor[action] !== version) {
      errors.push(zizmorSupportError(action, version));
    }
  }
  return errors;
}

function workflowFiles(directory) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    // Composite actions are optional. Do not hide other filesystem errors.
    if (error.code === 'ENOENT' && directory === '.github/actions') {
      return [];
    }
    throw error;
  }
  return entries.flatMap((entry) => {
    if (entry.name === 'node_modules') {
      return [];
    }
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? workflowFiles(path)
      : /\.ya?ml$/.test(path)
        ? [path]
        : [];
  });
}

/**
 * Keeps the zizmor `self-repository` ignore list equal to the set of
 * workflow and composite-action files that call a local action with
 * `uses: ./`, so the actionlint compatibility exception never covers a file
 * that does not need it and never misses one that does.
 *
 * @param {Record<string, string>} files Workflow and action YAML by path.
 * @param {string} config Contents of .github/zizmor.yml ('' when absent).
 * @returns {string[]} Policy violations.
 */
export function checkSelfRepositoryPolicy(files, config) {
  const block =
    config
      .replace(/\r\n/g, '\n')
      .match(
        /\n {2}self-repository:\n {4}ignore:\n((?: {6}- [^\n]+\r?\n?)*)/
      )?.[1] ?? '';
  const allowed = new Set(
    Array.from(block.matchAll(/- ([^\s]+)[ \t]*$/gm), (match) => match[1])
  );
  const errors = [];
  const used = new Set();
  for (const [path, text] of Object.entries(files)) {
    if (/^\s*(?:-\s+)?uses:\s+['"]?\.\//m.test(text)) {
      const name = path.split(/[\\/]/).at(-1);
      used.add(name);
      if (!allowed.has(name)) {
        errors.push(`Unlisted self-repository action user: ${path}`);
      }
    }
  }
  for (const name of allowed) {
    if (!used.has(name)) {
      errors.push(`Unused or broad self-repository exception: ${name}`);
    }
  }
  return errors;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const files = [
    ...workflowFiles('.github/workflows'),
    ...workflowFiles('.github/actions'),
  ];
  for (const path of files) {
    for (const error of checkWorkflowPolicy(readFileSync(path, 'utf8'))) {
      console.error(`::error file=${path}::${error}`);
      process.exitCode = 1;
    }
  }
  let selfRepositoryConfig = '';
  try {
    selfRepositoryConfig = readFileSync('.github/zizmor.yml', 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  for (const error of checkSelfRepositoryPolicy(
    Object.fromEntries(files.map((path) => [path, readFileSync(path, 'utf8')])),
    selfRepositoryConfig
  )) {
    console.error(`::error::${error}`);
    process.exitCode = 1;
  }
  if (!process.exitCode) {
    console.log('Workflow package, zizmor, and hosted runner pins verified');
  }
}
