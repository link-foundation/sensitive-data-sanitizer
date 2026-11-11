import { describe, it, expect } from 'test-anywhere';
import { resolve } from 'node:path';
import { createBetterleaksDetector, createSanitizer } from '../src/index.js';
import { runCli } from '../bin/sensitive-data-sanitizer.js';
import { itUnless, noPosixShell, nodeCliUnavailable } from './helpers/skip.js';
const fixture = resolve('experiments/issue-146/mock-betterleaks.mjs');
describe('full upstream Betterleaks detector', () => {
  it('has its own required detector identity', () => {
    expect(createBetterleaksDetector().id).toBe('betterleaks');
  });
  itUnless(nodeCliUnavailable, noPosixShell)(
    'runs read-only scanner flags and verifies publication',
    async () => {
      const detector = createBetterleaksDetector({ command: fixture });
      const findings = await detector.detect('external-private-value');
      expect(findings[0].rule).toBe('betterleaks');
      const engine = createSanitizer({
        secretlint: false,
        detectors: [detector],
      });
      expect((await engine.sanitize('external-private-value')).text).toBe(
        '[REDACTED]'
      );
    }
  );
  it('fails closed if the selected executable is missing', async () => {
    const engine = createSanitizer({
      secretlint: false,
      detectors: [
        createBetterleaksDetector({ command: 'nonexistent-sds-betterleaks' }),
      ],
    });
    let caught;
    try {
      await engine.sanitize('external-private-value');
    } catch (error) {
      caught = error;
    }
    expect(caught.code).toBe('ERR_ENGINE');
    expect(caught.message).not.toContain('external-private-value');
  });
  it('advertises the CLI integration', async () => {
    let output = '';
    const result = await runCli(['--help'], {
      stdout: {
        write: (text) => {
          output += text;
        },
      },
    });
    expect(result).toBe(0);
    expect(output).toContain('--betterleaks');
  });
});
