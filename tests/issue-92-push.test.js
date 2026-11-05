import assert from 'node:assert/strict';
import { describe, it } from 'test-anywhere';
import { pushWithRecovery } from '../scripts/push-main-with-rebase-retry.mjs';
import { isTransientPushFailure } from '../scripts/push-failure-classifier.mjs';

const logger = { log() {} };
const failed = (stderr) => ({ code: 1, stdout: '', stderr });
const internal = failed(
  'remote: fatal error in commit_refs_rules\n! [remote rejected] HEAD -> main'
);

describe('issue 92 release push recovery', () => {
  it('retries the reported server error without rebasing or making a PR', async () => {
    const commands = [];
    const sleeps = [];
    const result = await pushWithRecovery({
      runner: async (command, args) => {
        commands.push([command, ...args]);
        return commands.length === 1 ? internal : { code: 0 };
      },
      sleepFn: async (ms) => sleeps.push(ms),
      logger,
    });
    assert.equal(result.pushed, true);
    assert.deepEqual(
      commands,
      Array(2).fill(['git', 'push', 'origin', 'HEAD:main'])
    );
    assert.deepEqual(sleeps, [1000]);
  });

  it('stops after three server failures and retains the actual error', async () => {
    let attempts = 0;
    await assert.rejects(
      pushWithRecovery({
        runner: async () => {
          attempts++;
          return internal;
        },
        sleepFn: async () => {},
        logger,
      }),
      /fatal error in commit_refs_rules/
    );
    assert.equal(attempts, 3);
  });

  it('never classifies authentication failures or repository rules as transient', () => {
    for (const text of [
      'GH013: Repository rule violations',
      'GH006 protected branch',
      'Authentication failed',
      'GH013 fatal error in commit_refs_rules',
    ]) {
      assert.equal(isTransientPushFailure(failed(text)), false);
    }
    assert.equal(
      isTransientPushFailure(failed('The requested URL returned error: 503')),
      true
    );
  });

  it('fails permanent release rules without creating an automated PR', async () => {
    const commands = [];
    const messages = [];
    const parent = 'a'.repeat(40);
    await assert.rejects(
      pushWithRecovery({
        releaseParent: parent,
        runner: async (_command, args) => {
          commands.push(args);
          if (args[0] === 'rev-parse') {
            return {
              code: 0,
              stdout: `${args[1] === 'HEAD^' ? parent : 'b'.repeat(40)}\n`,
            };
          }
          if (args[0] === 'diff-tree') {
            return { code: 0, stdout: 'M\0package.json\0' };
          }
          return failed('GH013: Repository rule violations');
        },
        logger: { log: (message) => messages.push(message) },
      }),
      /Configure the rule/
    );
    assert.equal(commands.filter((args) => args[0] === 'push').length, 1);
    assert.equal(
      messages.some((message) => message.includes('landing the commit')),
      false
    );
    assert.equal(
      commands.some((args) => args[0] === 'pr'),
      false
    );
  });
});
