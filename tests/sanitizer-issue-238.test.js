import assert from 'node:assert/strict';
import { describe, it } from 'test-anywhere';
import {
  createSyncSanitizer,
  createSanitizer,
} from '../src/credentials-entry.js';

async function outputs(input, options) {
  return [
    createSyncSanitizer(options).sanitize(input).text,
    (await createSanitizer({ ...options, secretlint: false }).sanitize(input))
      .text,
  ];
}

describe('known credential collisions with redaction (issue 238)', () => {
  it('recovers from the reported hive marker and preserves adjacent text', async () => {
    assert.deepEqual(
      await outputs('ordinary REDACTED diagnostic\n', {
        preserveEncoding: true,
        transformation: { mode: 'hive-mask' },
        knownSecrets: ['REDACTED'],
      }),
      ['ordinary  diagnostic\n', 'ordinary  diagnostic\n']
    );
  });

  it('removes a literal marker supplied as a known credential, including in JSON', async () => {
    const options = { knownSecrets: ['[REDACTED]'] };
    assert.deepEqual(await outputs('before [REDACTED] after', options), [
      'before  after',
      'before  after',
    ]);
    const input = '{"password":"synthetic-value","event":"[REDACTED]"}';
    assert.deepEqual(
      await outputs(input, { ...options, structured: 'json' }),
      Array(2).fill('{"password":"","event":""}')
    );
  });

  it('rescans text joined by deletion and checks credentials in emitted partial masks', async () => {
    assert.deepEqual(
      await outputs('before abREDACTEDcd after', {
        knownSecrets: ['REDACTED', 'abcd'],
      }),
      ['before  after', 'before  after']
    );
    const options = {
      knownSecrets: ['fixture-tail'],
      transformation: { mode: 'hive-mask', preserveStart: 0, preserveEnd: 12 },
    };
    for (const output of await outputs(
      'password: "synthetic-fixture-tail"',
      options
    )) {
      assert.ok(!output.includes('fixture-tail'));
    }
  });

  it('returns only the failure stage and safe type counts for a nonconverging detector', async () => {
    const input = 'PRIVATE_FIXTURE_DATA';
    const options = {
      secretlint: false,
      detectors: [
        {
          detect: (text) =>
            text
              ? [
                  {
                    category: 'credential',
                    rule: 'fixture',
                    type: input,
                    start: 0,
                    end: text.length,
                  },
                ]
              : [],
        },
      ],
    };
    function check(error) {
      assert.deepEqual(
        { ...error },
        {
          code: 'ERR_RESIDUAL',
          stage: 'redaction-verification',
          findingCounts: { CUSTOM: 1 },
        }
      );
      assert.ok(!error.message.includes(input));
      return true;
    }
    assert.throws(() => createSyncSanitizer(options).sanitize(input), check);
    await assert.rejects(createSanitizer(options).sanitize(input), check);
  });
});
