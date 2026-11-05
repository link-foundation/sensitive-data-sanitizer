// Reproduce a startup false positive with finite delay/input and a 128 MiB heap.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { HANG_GUARD_MS, runBounded } from '../../tests/helpers/bounded-run.js';

const args = [
  '--max-old-space-size=128',
  '--import',
  `data:text/javascript,${encodeURIComponent(
    'await new Promise(resolve => setTimeout(resolve, 2100))'
  )}`,
  'experiments/issue-92/putty-probe.mjs',
];
const before = spawnSync('node', args, { timeout: 2000, encoding: 'utf8' });
assert.equal(before.error?.code, 'ETIMEDOUT');
const after = await runBounded('node', args, {
  timeout: HANG_GUARD_MS,
  env: { ...process.env, CI_SCRIPTS_DEBUG: '1' },
});
assert.equal(after.stdout.trim(), '0');
const timing = JSON.parse(after.stderr);
assert.ok(timing.initializationMs >= 2100);
assert.ok(timing.scanMs < 2000);
console.log(
  JSON.stringify(
    {
      oldWholeProcessDeadline: before.error.code,
      repaired: { elapsedMs: after.elapsedMs, ...timing },
      scanBudgetMs: 2000,
      hangGuardMs: HANG_GUARD_MS,
      heapLimitMiB: 128,
    },
    null,
    2
  )
);
