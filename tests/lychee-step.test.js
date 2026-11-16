import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { describe } from 'test-anywhere';
import { parse } from 'yaml';
import { itUnless, noPosixShell, sandboxed } from './helpers/skip.js';

const workflow = parse(readFileSync('.github/workflows/links.yml', 'utf8'));
const steps = workflow.jobs['link-checker'].steps;
const step = steps.find((item) => item.id === 'lychee');
const report = (total) =>
  `# Summary\n\n| Status | Count |\n|---|---|\n| 🔍 Total | ${total} |\n| 🚫 Errors | 0 |\n`;

// Runs the real `run:` script of the lychee step against a fake lychee that
// records its arguments and writes (or withholds) a prepared report.
function runStep(code, content, stale = false) {
  const root = mkdtempSync(join(tmpdir(), 'lychee-step-'));
  try {
    const bin = join(root, 'bin');
    mkdirSync(bin);
    writeFileSync(
      join(bin, 'lychee'),
      `#!/usr/bin/env bash
printf '%s\\n' "$@" > "$ARGUMENTS"
while [ "$#" -gt 0 ]; do
  if [ "$1" = --output ]; then
    if [ "$WRITE_REPORT" = yes ]; then cp "$REPORT" "$2"; fi
    break
  fi
  shift
done
exit "$CHECK_EXIT"
`,
      { mode: 0o755 }
    );
    if (stale) {
      mkdirSync(join(root, 'lychee'));
      writeFileSync(join(root, 'lychee/out.md'), report(42));
    }
    writeFileSync(join(root, 'report'), content ?? '');
    for (const file of ['output', 'summary']) {
      writeFileSync(join(root, file), '');
    }
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', step.run], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}${delimiter}${process.env.PATH}`,
        GITHUB_OUTPUT: join(root, 'output'),
        GITHUB_STEP_SUMMARY: join(root, 'summary'),
        ARGUMENTS: join(root, 'arguments'),
        REPORT: join(root, 'report'),
        WRITE_REPORT: content === undefined ? 'no' : 'yes',
        CHECK_EXIT: String(code),
      },
    });
    return {
      ...result,
      output: readFileSync(join(root, 'output'), 'utf8'),
      summary: readFileSync(join(root, 'summary'), 'utf8'),
      arguments: readFileSync(join(root, 'arguments'), 'utf8')
        .trim()
        .split('\n'),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('actual lychee workflow step', () => {
  const check = itUnless(sandboxed, noPosixShell);
  check('publishes a successful report and preserves all scan options', () => {
    const result = runStep(0, report(42));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'exit_code=0\n');
    assert.equal(result.summary, report(42));
    assert.deepEqual(result.arguments, [
      '--mode',
      'task',
      '--format',
      'markdown',
      '--output',
      'lychee/out.md',
      '--verbose',
      '--no-progress',
      '--cache',
      '--max-cache-age',
      '1d',
      '--max-retries',
      '3',
      '--timeout',
      '30',
      '--hidden',
      '--extensions',
      'md,html',
      '--exclude-path',
      'docs/case-studies',
      '--exclude-path',
      'dev/log',
      '--exclude-path',
      'examples/universal-app/index.html',
      '--exclude-path',
      'tests/fixtures',
      '.',
    ]);
  });
  check(
    'keeps broken-link exit 2 available to recovery and final failure steps',
    () => {
      const broken = report(42).replace('Errors | 0', 'Errors | 1');
      const result = runStep(2, broken);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.output, 'exit_code=2\n');
      assert.equal(result.summary, broken);
    }
  );
  for (const [name, code, content, stale] of [
    ['bad arguments', 2, undefined, false],
    ['a stale report after bad arguments', 2, undefined, true],
    ['no report even on success', 0, undefined, false],
    ['empty output', 0, '', false],
    ['zero checked links', 0, report(0), false],
    ['malformed summary', 0, 'not a report', false],
    ['unexpected exit status', 1, report(42), false],
  ]) {
    check(`fails for ${name}`, () => {
      const result = runStep(code, content, stale);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stdout, /::error title=/);
    });
  }
});

describe('lychee installation and link cache steps', () => {
  const check = itUnless(sandboxed);
  const index = (predicate) => steps.findIndex(predicate);

  check('installs lychee under a step budget before the check runs', () => {
    const install = steps.find((item) =>
      item.run?.includes('scripts/install-lychee.sh')
    );
    assert.ok(install, 'no step runs scripts/install-lychee.sh');
    assert.match(
      install.run,
      /^bash scripts\/run-with-budget-warning\.sh \d+ "[^"]+" bash scripts\/install-lychee\.sh$/
    );
    assert.ok(steps.indexOf(install) < steps.indexOf(step));
    assert.ok(
      steps.every((item) => !item.uses?.startsWith('lycheeverse/')),
      'the lychee action must not download lychee a second time'
    );
  });

  check('restores the link cache on every run before the check', () => {
    const restore = index((item) =>
      item.uses?.startsWith('actions/cache/restore@')
    );
    assert.ok(restore >= 0 && restore < steps.indexOf(step));
    assert.equal(steps[restore].if, undefined);
    assert.equal(steps[restore].with.path, '.lycheecache');
    assert.ok(
      steps.every((item) => !/^actions\/cache@/.test(item.uses ?? '')),
      'the combined cache action would save from pull request runs'
    );
  });

  check('saves the link cache only from main pushes without a hit', () => {
    const restore = steps.find((item) =>
      item.uses?.startsWith('actions/cache/restore@')
    );
    const save = index((item) => item.uses?.startsWith('actions/cache/save@'));
    assert.ok(save > steps.indexOf(step));
    assert.equal(
      steps[save].if,
      `github.event_name == 'push' && github.ref == 'refs/heads/main' && steps.${restore.id}.outputs.cache-hit != 'true'`
    );
    assert.equal(steps[save].with.path, '.lycheecache');
    assert.equal(
      steps[save].with.key,
      `\${{ steps.${restore.id}.outputs.cache-primary-key }}`
    );
    assert.equal(
      steps[save].uses.split('@')[1],
      restore.uses.split('@')[1],
      'restore and save must use the same cache action release'
    );
  });
});
