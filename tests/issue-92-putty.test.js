import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'test-anywhere';
import { detectCredentialFormats } from '../src/credentials.js';
import { sandboxed, itUnless } from './helpers/skip.js';

describe('issue 92 PuTTY scanning', () => {
  itUnless(sandboxed)(
    'bounds repeated incomplete headers in a separate process',
    () => {
      const result = spawnSync(
        'node',
        ['--max-old-space-size=128', 'experiments/issue-92/putty-probe.mjs'],
        {
          encoding: 'utf8',
          timeout: 2000,
        }
      );
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), '0');
    }
  );

  for (const newline of ['\n', '\r', '\r\n']) {
    it(`preserves separate complete blocks and incomplete-body protection with ${JSON.stringify(newline)}`, () => {
      const block = `PuTTY-User-Key-File-3: ssh-ed25519${newline}Private-MAC: ab`;
      const input = `${block}${newline}${block}${newline}PuTTY-User-Key-File-2: key${newline}private body`;
      const findings = [];
      detectCredentialFormats(input, (finding) => findings.push(finding));
      const keys = findings.filter(
        (finding) => finding.rule === 'putty-private-key'
      );
      assert.equal(keys.length, 3);
      assert.deepEqual(
        keys.map(({ start, end }) => input.slice(start, end)),
        [block, block, `PuTTY-User-Key-File-2: key${newline}private body`]
      );
    });
  }
});
