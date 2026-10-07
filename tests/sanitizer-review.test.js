import { describe, it, expect } from 'test-anywhere';
import { createSanitizer } from '../src/index.js';
import { reviewFixtures } from './fixtures/sanitizer-review.js';

describe('requirements review default-engine regressions', () => {
  const engine = createSanitizer();
  for (const [id, input, expected] of reviewFixtures) {
    it(`covers the entire ${id} value`, async () => {
      expect((await engine.sanitize(input)).text).toBe(expected);
    });
  }
});
