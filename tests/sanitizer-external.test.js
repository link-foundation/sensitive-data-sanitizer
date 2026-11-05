import { itUnless, nodeCliUnavailable } from './helpers/skip.js';
import { describe, expect } from 'test-anywhere';
import { resolve } from 'node:path';
import { createSanitizer, createPresidioDetector } from '../src/index.js';

const fixture = resolve('experiments/mock-scanner.mjs');
function detector(mode, extra = {}) {
  return createPresidioDetector({
    command: process.execPath,
    args: [fixture, mode],
    ...extra,
  });
}
describe('required local subprocess adapters', () => {
  itUnless(nodeCliUnavailable)(
    'joins local NER with native detection and verifies the result',
    async () => {
      const engine = createSanitizer({
        secretlint: false,
        detectors: [detector('pii')],
      });
      expect((await engine.sanitize('😀 Zoë password=short')).text).toBe(
        '😀 [REDACTED] password=[REDACTED]'
      );
    }
  );
  for (const mode of ['error', 'large', 'malformed', 'slow']) {
    itUnless(nodeCliUnavailable)(
      `blocks publication when a required scanner returns ${mode}`,
      async () => {
        const engine = createSanitizer({
          secretlint: false,
          detectors: [
            detector(mode, {
              maxOutputBytes: 1024,
              timeoutMs: mode === 'slow' ? 150 : 30000,
            }),
          ],
        });
        let error;
        try {
          await engine.sanitize('synthetic-private-detail');
        } catch (caught) {
          error = caught;
        }
        expect(error.code).toBe('ERR_ENGINE');
        expect(error.message.includes('synthetic-private-detail')).toBe(false);
      }
    );
  }
});
