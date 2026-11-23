import { expect } from 'test-anywhere';
import { LONG_TEST_TIMEOUT, itWithin } from './helpers/long-test.js';
import { large, options, run, secret, tails } from './helpers/issue-172.js';
import { createSyncSanitizer } from '../src/credentials-entry.js';

itWithin(
  'sanitizes the issue 172 reproduction through createSyncSanitizer',
  LONG_TEST_TIMEOUT,
  () => {
    const engine = createSyncSanitizer({ credentialsOnly: true, ...options });
    for (const [name, tail] of Object.entries(tails)) {
      const result = engine.sanitize(run('Ab', large) + tail);
      expect([name, result.text.includes(secret)]).toEqual([name, false]);
    }
  }
);
