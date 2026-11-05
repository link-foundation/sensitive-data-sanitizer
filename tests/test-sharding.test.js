import { it, expect } from 'test-anywhere';
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
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

it('covers every runtime and OS once while distributing Windows Bun and Deno fixtures', () => {
  const workflow = parse(readFileSync('.github/workflows/release.yml', 'utf8'));
  const matrix = workflow.jobs.test.strategy.matrix;
  const legs = matrix.os.flatMap((os) =>
    matrix.runtime.flatMap((runtime) =>
      matrix.shard.map((shard) => ({ os, runtime, shard }))
    )
  );
  const selected = legs.filter(
    (leg) =>
      !(matrix.exclude ?? []).some((excluded) =>
        Object.entries(excluded).every(([key, value]) => leg[key] === value)
      )
  );
  selected.push(...matrix.include);
  const files = readdirSync('tests');
  const whole = selectTests(files, '1/1');
  for (const os of ['ubuntu-24.04', 'windows-2025', 'macos-26-intel']) {
    for (const runtime of ['node', 'bun', 'deno']) {
      const shards = selected.filter(
        (leg) => leg.os === os && leg.runtime === runtime
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
      if (os === 'macos-26-intel' && runtime === 'deno') {
        // These subprocess-heavy files consumed most of the suite budget
        // together on a cold runner. Keep them in separate execution jobs.
        const expensive = [
          'pr-guards.test.js',
          'release-api-integrity.test.js',
          'detect-code-changes.test.js',
          'run-with-budget-warning.test.js',
          'release-preflight.test.js',
          'sanitizer-jsonl-stream.test.js',
        ];
        expect(
          shards.every(
            ({ shard }) =>
              selectTests(files, shard).filter((file) =>
                expensive.some((name) => file === `tests/${name}`)
              ).length <= 1
          )
        ).toBe(true);
      }
    }
  }
});

it('rejects invalid shard selection and empty or unknown runtime commands', () => {
  for (const shard of ['0/3', '4/3', '1/0', 'all', '1/2/3']) {
    expect(() => selectTests(['a.test.js'], shard)).toThrow();
  }
  expect(() => testCommand('unknown', ['tests/a.test.js'])).toThrow();
  expect(() => testCommand('bun', [])).toThrow();
});

it('keeps measured expensive suites apart as unrelated files are added', () => {
  const expensive = [
    'pr-guards.test.js',
    'release-api-integrity.test.js',
    'detect-code-changes.test.js',
    'run-with-budget-warning.test.js',
    'release-preflight.test.js',
    'sanitizer-jsonl-stream.test.js',
  ];
  for (const count of [3, 4, 6]) {
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
    ['test', '-A', '--parallel', ...files],
  ]);
});
