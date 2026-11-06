import { describe, it, expect } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const action = parse(
  readFileSync('.github/actions/setup-buildx-resilient/action.yml', 'utf8')
);
const [canonical, mirror] = action.runs.steps;

describe('upstream Buildx retries and registry fallback', () => {
  it('delegates both pulls and bootstrap to the same reviewed upstream release', () => {
    expect(canonical.uses).toBe('docker/setup-buildx-action@v4.4.1');
    expect(mirror.uses).toBe(canonical.uses);
    expect(canonical.with.version).toBe('v0.38.2');
    expect(mirror.with.version).toBe(canonical.with.version);
    expect(canonical.with['driver-opts']).toBe(
      'image=${{ inputs.buildkit-image }}'
    );
    expect(mirror.with['driver-opts']).toBe(
      'image=${{ inputs.registry-mirror }}/${{ inputs.buildkit-image }}'
    );
  });

  it('recovers only a failed canonical setup and propagates exhausted retries', () => {
    expect(canonical['continue-on-error']).toBe(
      "${{ inputs.registry-mirror != '' }}"
    );
    expect(mirror.if).toBe(
      "steps.canonical.outcome == 'failure' && inputs.registry-mirror != ''"
    );
    expect(mirror['continue-on-error']).toBeUndefined();
  });

  it('keeps mirror opt-out and forwards verbose and runner debug settings', () => {
    expect(action.inputs['registry-mirror'].default).toBe('mirror.gcr.io');
    expect(action.inputs['buildkit-image'].default).toBe(
      'moby/buildkit:v0.34.2'
    );
    for (const step of action.runs.steps) {
      expect(step.env.RUNNER_DEBUG).toContain("inputs.verbose == 'true'");
      expect(step.env.RUNNER_DEBUG).toContain('env.RUNNER_DEBUG');
    }
  });
});
