#!/usr/bin/env node
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function selectTests(files, shard) {
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(shard);
  if (!match || Number(match[1]) > Number(match[2])) {
    throw new Error(
      'Expected a test shard index/count, with 1 <= index <= count'
    );
  }
  const [, index, count] = match.map(Number);
  // Seed separate shards with the measured subprocess-heavy suites. Merely
  // sorting all filenames can colocate these whenever another test is added.
  const expensive = [
    'pr-guards.test.js',
    'release-api-integrity.test.js',
    'detect-code-changes.test.js',
    'run-with-budget-warning.test.js',
    'release-preflight.test.js',
    'sanitizer-jsonl-stream.test.js',
  ];
  const tests = files.filter((file) => file.endsWith('.test.js')).sort();
  const ordered = [
    ...expensive.filter((file) => tests.includes(file)),
    ...tests.filter((file) => !expensive.includes(file)),
  ];
  return ordered
    .filter((_, position) => position % count === index - 1)
    .sort()
    .map((file) => `tests/${file}`);
}

export function testCommand(runtime, files) {
  const options = {
    node: ['--test', '--test-timeout=30000'],
    bun: ['test', '--timeout', '30000'],
    deno: ['test', '-A', '--parallel'],
  };
  if (!Object.hasOwn(options, runtime) || files.length === 0) {
    throw new Error('Expected node, bun or deno and a nonempty test shard');
  }
  return [runtime, [...options[runtime], ...files]];
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [runtime, shard] = process.argv.slice(2);
  const files = selectTests(readdirSync('tests'), shard);
  const [command, args] = testCommand(runtime, files);
  console.log(`Running ${runtime} shard ${shard}: ${files.length} test files`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) {
    console.error(result.error.message);
  }
  process.exitCode = result.status ?? 1;
}
