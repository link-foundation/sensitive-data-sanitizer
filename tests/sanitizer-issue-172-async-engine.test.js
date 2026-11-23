import { expect } from 'test-anywhere';
import { LONG_TEST_TIMEOUT, itWithin } from './helpers/long-test.js';
import { large, options, run, secret } from './helpers/issue-172.js';
import { createSanitizer } from '../src/index.js';

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
