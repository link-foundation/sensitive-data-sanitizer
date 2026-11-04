import { it, expect } from 'test-anywhere';
import { readdirSync } from 'node:fs';
import { selectTests, testCommand } from '../scripts/run-test-shard.mjs';

it('partitions every test file exactly once, independent of directory order', () => {
  const files = readdirSync('tests');
  const whole = selectTests(files, '1/1');
  const shards = [1, 2, 3].map((index) => selectTests(files, `${index}/3`));
  expect(shards.flat().sort()).toEqual(whole);
  expect(new Set(shards.flat()).size).toBe(whole.length);
  expect(selectTests([...files].reverse(), '2/3')).toEqual(shards[1]);
  expect(
    Math.max(...shards.map((s) => s.length)) -
      Math.min(...shards.map((s) => s.length)) <=
      1
  ).toBe(true);
});

it('rejects invalid shard selection and empty or unknown runtime commands', () => {
  for (const shard of ['0/3', '4/3', '1/0', 'all', '1/2/3']) {
    expect(() => selectTests(['a.test.js'], shard)).toThrow();
  }
  expect(() => testCommand('unknown', ['tests/a.test.js'])).toThrow();
  expect(() => testCommand('bun', [])).toThrow();
});

it('preserves per-test limits and explicit file selection for each runtime', () => {
  const files = ['tests/a.test.js'];
  expect(testCommand('node', files)).toEqual([
    'node',
    ['--test', '--test-timeout=30000', ...files],
  ]);
  expect(testCommand('bun', files)).toEqual([
    'bun',
    ['test', '--timeout', '30000', ...files],
  ]);
  expect(testCommand('deno', files)).toEqual([
    'deno',
    ['test', '--allow-read', '--allow-env', ...files],
  ]);
});
