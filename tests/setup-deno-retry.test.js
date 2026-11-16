import { describe, it, expect } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

// Issue 208: setup-deno gave up after about 8 seconds of `fetch failed` on a
// macOS runner. The test job retries it once, and only once.
const steps = parse(readFileSync('.github/workflows/release.yml', 'utf8')).jobs
  .test.steps;
const deno = steps.filter((step) =>
  String(step.uses ?? '').startsWith('denoland/setup-deno@')
);
const pause = steps.find(
  (step) => step.name === 'Wait before retrying the Deno download'
);

describe('Deno setup retry', () => {
  it('runs the same reviewed setup-deno release and version twice', () => {
    expect(deno.length).toBe(2);
    const [first, retry] = deno;
    expect(first.uses).toMatch(/^denoland\/setup-deno@[0-9a-f]{40}$/);
    expect(retry.uses).toBe(first.uses);
    expect(retry.with).toEqual(first.with);
  });

  it('retries only a failed first attempt and lets the retry fail the job', () => {
    const [first, retry] = deno;
    expect(first.id).toBe('setup-deno');
    expect(first['continue-on-error']).toBe(true);
    const condition =
      "matrix.runtime == 'deno' && steps.setup-deno.outcome == 'failure'";
    expect(retry.if).toBe(condition);
    expect(retry['continue-on-error']).toBeUndefined();
    expect(pause.if).toBe(condition);
    expect(steps.indexOf(first) < steps.indexOf(pause)).toBe(true);
    expect(steps.indexOf(pause) < steps.indexOf(retry)).toBe(true);
  });

  it('explains the first attempt annotation with a notice', () => {
    expect(pause.run).toContain('::notice title=Deno download retried::');
  });
});
