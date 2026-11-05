import assert from 'node:assert/strict';
import { describe, it } from 'test-anywhere';
import { detectIdentity } from '../src/identity.js';
import { detectPersonal } from '../src/personal.js';
import { itUnless, sandboxed } from './helpers/skip.js';
import { HANG_GUARD_MS, runBounded } from './helpers/bounded-run.js';

describe('issue 92 whitespace scanning', () => {
  for (const kind of ['booking', 'ticket', 'visa', 'postal']) {
    itUnless(sandboxed)(`bounds the ${kind} CodeQL witness`, async () => {
      const result = await runBounded(
        'node',
        [
          '--max-old-space-size=128',
          'experiments/issue-92/whitespace-probe.mjs',
          kind,
        ],
        { timeout: HANG_GUARD_MS }
      );
      assert.equal(result.stdout.trim(), 'completed');
    });
  }
  for (const separator of [' ', '\t', ':', ' : ', '=', '：\t']) {
    it(`preserves travel values after ${JSON.stringify(separator)}`, () => {
      const text = `booking${separator}AB12CD; ticket${separator}123 1234567890; visa${separator}AB12345`;
      const findings = [];
      detectIdentity(text, (finding) => findings.push(finding));
      for (const value of ['AB12CD', '123 1234567890', 'AB12345']) {
        assert.ok(
          findings.some(({ start, end }) => text.slice(start, end) === value),
          value
        );
      }
    });
  }
  it('preserves city and postal code address extents', () => {
    for (const tail of ['London SW1A 1AA', 'New York 10001', '\t\t10001']) {
      const text = `12 Main Street, ${tail}`;
      const findings = [];
      detectPersonal(text, (finding) => findings.push(finding));
      assert.ok(
        findings.some(
          ({ start, end, rule }) =>
            rule === 'postal-address' && text.slice(start, end) === text
        )
      );
    }
  });
});
