import { describe, expect } from 'test-anywhere';
import { LONG_TEST_TIMEOUT, itWithin } from './helpers/long-test.js';
import { large, options, run, secret, tails } from './helpers/issue-172.js';
import { createSyncSanitizer } from '../src/credentials-entry.js';
import { createSanitizer } from '../src/index.js';

// The whole-engine half of the issue 172 tests (see helpers/issue-172.js).
// Together with the file-to-file test it took about 80 s of a 200 s macOS
// Intel Bun budget, so each half runs in its own shard (issue 208).
describe('issue 172: long runs in two-byte strings through the engines', () => {
  itWithin(
    'sanitizes the issue reproduction through createSyncSanitizer',
    LONG_TEST_TIMEOUT,
    () => {
      const engine = createSyncSanitizer({ credentialsOnly: true, ...options });
      for (const [name, tail] of Object.entries(tails)) {
        const result = engine.sanitize(run('Ab', large) + tail);
        expect([name, result.text.includes(secret)]).toEqual([name, false]);
      }
    }
  );

  itWithin(
    'sanitizes a long run with personal data through createSanitizer',
    LONG_TEST_TIMEOUT,
    async () => {
      const text = `${run('A', large)}\n🔐 token refreshed — mail jane.doe@example.com\npassword=${secret}\n`;
      const result = await createSanitizer(options).sanitize(text);
      expect(result.text.includes(secret)).toBe(false);
      expect(result.text.includes('jane.doe@example.com')).toBe(false);
    }
  );
});
