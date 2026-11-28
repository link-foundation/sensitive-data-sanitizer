import assert from 'node:assert/strict';
import { describe, it } from 'test-anywhere';
import {
  createSyncSanitizer,
  createSanitizer,
} from '../src/credentials-entry.js';

describe('custom replacement of opaque encoded content (issue 237)', () => {
  const opaque = '%20'.repeat(3000);
  const harmless = '[Sensitive content omitted]';

  it('replaces an opaque span in the synchronous and asynchronous engines', async () => {
    const sync = createSyncSanitizer({ transformation: () => harmless });
    const asyncEngine = createSanitizer({
      secretlint: false,
      transformation: async () => harmless,
    });
    assert.deepEqual(
      sync.inspect(opaque).map(({ type }) => type),
      ['ENCODED_LIMIT']
    );
    assert.equal(sync.sanitize(opaque).text, harmless);
    assert.equal((await asyncEngine.sanitize(opaque)).text, harmless);
  });

  it('rejects both unchanged opaque content and a different opaque replacement', async () => {
    for (const replacement of [opaque, '%09'.repeat(3000)]) {
      const options = { transformation: () => replacement };
      assert.throws(() => createSyncSanitizer(options).sanitize(opaque), {
        code: 'ERR_RESIDUAL',
      });
      await assert.rejects(
        createSanitizer({ ...options, secretlint: false }).sanitize(opaque),
        { code: 'ERR_RESIDUAL' }
      );
    }
  });
});
