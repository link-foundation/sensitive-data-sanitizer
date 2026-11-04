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
  return files
    .filter((file) => file.endsWith('.test.js'))
    .sort()
    .filter((_, position) => position % count === index - 1)
    .map((file) => `tests/${file}`);
}

export function testCommand(runtime, files) {
  const options = {
    node: ['--test', '--test-timeout=30000'],
    bun: ['test', '--timeout', '30000'],
    deno: ['test', '--allow-read', '--allow-env'],
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
