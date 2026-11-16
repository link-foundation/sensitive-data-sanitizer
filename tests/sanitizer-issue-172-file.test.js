import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect } from 'test-anywhere';
import { LONG_TEST_TIMEOUT, itWithin } from './helpers/long-test.js';
import { options, run, secret } from './helpers/issue-172.js';
import { sanitizeFileToFile } from '../src/index.js';

// The file-to-file part of the issue 172 tests (see helpers/issue-172.js),
// in its own file so that it runs in another shard than the engine tests.
describe('issue 172: long runs in two-byte strings through files', () => {
  itWithin(
    'sanitizes the gh-upload-log record shape through sanitizeFileToFile',
    LONG_TEST_TIMEOUT,
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'issue-172-'));
      try {
        const input = join(dir, 'in.log');
        const output = join(dir, 'out.log');
        writeFileSync(
          input,
          `✅ step started — ok\n{"type":"image","data":"${run('A', 6 * 1024 * 1024)}"}\n🔐 token refreshed\npassword=${secret}\n`
        );
        await sanitizeFileToFile(input, output, options);
        const text = readFileSync(output, 'utf8');
        expect(text.includes(secret)).toBe(false);
        expect(text.includes('🔐 token refreshed')).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  );
});
