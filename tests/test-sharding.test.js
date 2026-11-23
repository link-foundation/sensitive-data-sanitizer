import { it, expect } from 'test-anywhere';
import { readdirSync } from 'node:fs';
import { selectTests, testCommand } from '../scripts/run-test-shard.mjs';
import { createTestMatrix } from '../scripts/node-lts-matrix.mjs';

const engineTests = [
  'sanitizer-issue-172-async-engine.test.js',
  'sanitizer-issue-172-sync-engine.test.js',
];
const expensive = [
  'pr-guards.test.js',
  'release-api-integrity.test.js',
  'detect-code-changes.test.js',
  'run-with-budget-warning.test.js',
  'release-preflight.test.js',
  'sanitizer-jsonl-stream.test.js',
  'sanitizer-issue-172.test.js',
  ...engineTests,
  'sanitizer-issue-172-file.test.js',
  'sanitizer-issue-170.test.js',
  'sanitizer-issue-128-evidence.test.js',
];

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

it('covers each runtime version and OS once while distributing Bun and Deno fixtures', () => {
  const nodeVersions = ['22.23.5', '24.22.3', '26.13.1', '27.3.0'];
  const { include } = createTestMatrix(nodeVersions);
  const files = readdirSync('tests');
  const whole = selectTests(files, '1/1');
  const runtimes = [
    ...nodeVersions.map((node) => ({ runtime: 'node', node })),
    { runtime: 'bun', node: '' },
    { runtime: 'deno', node: '' },
  ];
  for (const os of ['ubuntu-24.04', 'windows-2025', 'macos-26-intel']) {
    for (const { runtime, node } of runtimes) {
      const shards = include.filter(
        (leg) => leg.os === os && leg.runtime === runtime && leg.node === node
      );
      const covered = shards.flatMap(({ shard }) => selectTests(files, shard));
      expect(covered.sort()).toEqual(whole);
      expect(new Set(covered).size).toBe(whole.length);
      if (os === 'windows-2025' && ['bun', 'deno'].includes(runtime)) {
        expect(
          shards.every(
            ({ shard }) => selectTests(files, shard).length < whole.length / 2
          )
        ).toBe(true);
      }
      if (os === 'ubuntu-24.04' && runtime === 'bun') {
        // Bun runs files serially; the whole suite neared its 200s budget.
        expect(shards.length).toBeGreaterThan(1);
        expect(
          shards.every(
            ({ shard }) =>
              selectTests(files, shard).length <= Math.ceil(whole.length / 2)
          )
        ).toBe(true);
      }
      if (os === 'macos-26-intel' && ['bun', 'deno'].includes(runtime)) {
        // These heavy files consumed most of the suite budget
        // together on a cold runner. Keep them in separate execution jobs.
        const counted = (names) =>
          shards.map(
            ({ shard }) =>
              selectTests(files, shard).filter((file) =>
                names.some((name) => file === `tests/${name}`)
              ).length
          );
        expect(
          counted(expensive).every(
            (n) => n <= Math.ceil(expensive.length / shards.length)
          )
        ).toBe(true);
        // The issue 172 parts took 128 s of the 200 s budget in one file.
        expect(
          counted(expensive.filter((name) => name.includes('issue-172'))).every(
            (n) => n <= 1
          )
        ).toBe(true);
      }
    }
  }
});

it('runs the long engine tests in separate macOS Node.js shards', () => {
  const files = readdirSync('tests');
  const { include } = createTestMatrix(['22.23.5']);
  const shards = include.filter(
    ({ os, runtime }) => os === 'macos-26-intel' && runtime === 'node'
  );
  const assignments = shards.map(({ shard }) => selectTests(files, shard));
  const engineShards = engineTests.map((file) =>
    assignments.findIndex((tests) => tests.includes(`tests/${file}`))
  );
  expect(engineShards.every((index) => index !== -1)).toBe(true);
  expect(new Set(engineShards).size).toBe(engineTests.length);
});

it('rejects invalid shard selection and empty or unknown runtime commands', () => {
  for (const shard of ['0/3', '4/3', '1/0', 'all', '1/2/3']) {
    expect(() => selectTests(['a.test.js'], shard)).toThrow();
  }
  expect(() => testCommand('unknown', ['tests/a.test.js'])).toThrow();
  expect(() => testCommand('bun', [])).toThrow();
});

it('keeps measured expensive suites apart as unrelated files are added', () => {
  for (const count of [2, 3, 4, 6]) {
    for (let extra = 0; extra <= 12; extra++) {
      const files = [
        ...expensive,
        ...Array.from(
          { length: extra },
          (_, index) => `extra-${index}.test.js`
        ),
      ];
      const shards = Array.from({ length: count }, (_, index) =>
        selectTests(files, `${index + 1}/${count}`)
      );
      for (const shard of shards) {
        expect(
          shard.filter((file) => expensive.includes(file.slice(6))).length <=
            Math.ceil(expensive.length / count)
        ).toBe(true);
      }
    }
  }
});

it('passes the timeout and explicit file selection for each runtime', () => {
  const files = ['tests/a.test.js'];
  expect(testCommand('node', files, 24)).toEqual([
    'node',
    ['--test', '--test-timeout=30000', ...files],
  ]);
  expect(testCommand('node', files, 22)).toEqual([
    'node',
    ['--test', '--test-timeout=90000', ...files],
  ]);
  expect(testCommand('bun', files)).toEqual([
    'bun',
    ['test', '--timeout', '30000', ...files],
  ]);
  expect(testCommand('deno', files)).toEqual([
    'deno',
    ['test', '-A', '--parallel', ...files],
  ]);
});
