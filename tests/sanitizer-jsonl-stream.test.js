import { describe, it, expect } from 'test-anywhere';
import { sanitizeStream, createSanitizer } from '../src/index.js';
import { execFileSync } from 'node:child_process';

async function collect(source, options) {
  let output = '';
  for await (const chunk of sanitizeStream(source, options)) {
    output += chunk;
  }
  return output;
}
describe('ordered bounded JSONL streaming', () => {
  it('starts file workers when the parent uses module eval input', () => {
    if (typeof Bun !== 'undefined' || typeof Deno !== 'undefined') {
      return;
    }
    const source = `import {sanitizeStream} from './src/index.js';
      for await (const chunk of sanitizeStream(['{}\\n'], {structured:'jsonl', workers:2})) process.stdout.write(chunk);`;
    expect(
      execFileSync(
        process.execPath,
        [
          '--max-old-space-size=512',
          '--stack-size=4096',
          '--input-type=module',
          '-e',
          source,
        ],
        { encoding: 'utf8' }
      )
    ).toBe('{}\n');
  });
  it('matches whole-input output in parallel with split UTF-8 and CRLF', async () => {
    const input = `${Array.from({ length: 8 }, (_, i) =>
      JSON.stringify({
        message: 'Привет',
        ordinal: i,
        password: `private-${i}`,
      })
    ).join('\r\n')}\r\n`;
    const bytes = Buffer.from(input);
    const chunks = Array.from({ length: Math.ceil(bytes.length / 7) }, (_, i) =>
      bytes.subarray(i * 7, i * 7 + 7)
    );
    const expected = (
      await createSanitizer({ structured: 'jsonl' }).sanitize(input)
    ).text;
    expect(
      await collect(chunks, {
        structured: 'jsonl',
        workers: 2,
        batchBytes: 100,
      })
    ).toBe(expected);
  });
  it('accepts a seven-megabyte record followed by records above the whole-input limit', async () => {
    const record = `${JSON.stringify({
      stdout: 'ordinary '.repeat(820000),
      password: 'short-private',
    })}\n`;
    expect(Buffer.byteLength(record) > 7 * 1024 * 1024).toBe(true);
    const output = await collect([record, record], {
      structured: 'jsonl',
      workers: 2,
    });
    expect(output.includes('short-private')).toBe(false);
    expect(output.split('\n').filter(Boolean).map(JSON.parse).length).toBe(2);
  });
  it('retains deterministic keyed fakes regardless of scheduling', async () => {
    const input = Array.from({ length: 6 }, (_, i) =>
      JSON.stringify({ i, person: 'Marina Kovaleva', pnr: 'K7QWZP' })
    ).join('\n');
    const options = {
      structured: 'jsonl',
      batchBytes: 1,
      transformation: { mode: 'fake', key: 'private-stream-fixture-key' },
    };
    expect(await collect([input], { ...options, workers: 2 })).toBe(
      await collect([input], { ...options, workers: 1 })
    );
  });
  it('blocks invalid records, incomplete UTF-8, oversized records and invalid worker limits', async () => {
    for (const [input, options, code] of [
      ['{}\n{', {}, 'ERR_JSON'],
      [Buffer.from([0xe2, 0x82]), {}, 'ERR_ENCODING'],
      [
        JSON.stringify({ x: 'a'.repeat(130) }),
        { maxRecordBytes: 128 },
        'ERR_LIMIT',
      ],
      ['{}', { workers: 0 }, 'ERR_CONFIG'],
    ]) {
      let actual;
      try {
        await collect([input], { structured: 'jsonl', workers: 1, ...options });
      } catch (error) {
        actual = error.code;
      }
      expect(actual).toBe(code);
    }
  });
  it('propagates worker failures and terminates workers on early consumer cancellation', async () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    let actual;
    try {
      await collect(['{}\n'], {
        structured: 'jsonl',
        workers: 2,
        workerTimeoutMs: 1,
      });
    } catch (error) {
      actual = error.code;
    }
    expect(actual).toBe('ERR_WORKER');
    const stream = sanitizeStream(['{}\n'.repeat(30)], {
      structured: 'jsonl',
      workers: 2,
      batchBytes: 1,
    });
    expect((await stream.next()).value).toBe('{}\n');
    await stream.return();
  });
});
