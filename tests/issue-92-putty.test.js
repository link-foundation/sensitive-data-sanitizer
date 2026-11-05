import assert from 'node:assert/strict';
import { describe, it } from 'test-anywhere';
import { detectCredentialFormats } from '../src/credentials.js';
import { sandboxed, itUnless } from './helpers/skip.js';
import { HANG_GUARD_MS, runBounded } from './helpers/bounded-run.js';

describe('issue 92 PuTTY scanning', () => {
  itUnless(sandboxed)(
    'bounds repeated incomplete headers separately from cold module startup',
    async () => {
      // Windows can spend more than two seconds starting Node and loading
      // the scanner's module graph. Reproduce that independently of scan speed.
      const preload = `data:text/javascript,${encodeURIComponent(
        'await new Promise(resolve => setTimeout(resolve, 2100))'
      )}`;
      const result = await runBounded(
        'node',
        [
          '--max-old-space-size=128',
          '--import',
          preload,
          'experiments/issue-92/putty-probe.mjs',
        ],
        {
          timeout: HANG_GUARD_MS,
          env: { ...process.env, CI_SCRIPTS_DEBUG: '1' },
        }
      );
      assert.equal(result.stdout.trim(), '0');
      const timing = JSON.parse(result.stderr);
      assert.ok(timing.initializationMs >= 2100);
      assert.ok(timing.scanMs < 2000);
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
