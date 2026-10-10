import { describe, it, expect } from 'test-anywhere';
import { runCli } from '../bin/sensitive-data-sanitizer.js';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

async function invoke(args, chunks) {
  let output = '',
    errors = '';
  const status = await runCli(args, {
    stdin: Readable.from(chunks),
    stdout: {
      write(value) {
        output += value;
      },
    },
    stderr: {
      write(value) {
        errors += value;
      },
    },
  });
  return { status, output, errors };
}
describe('streaming publication CLI', () => {
  it('uses the publication profile for bare identities and permits explicit full redaction', async () => {
    const result = await invoke(
      ['redact', '-', '--native-only'],
      ['46 21 573918\n487-192-053 19\n771829456048']
    );
    expect(result.status).toBe(0);
    expect(result.output.includes('573918')).toBe(false);
    expect(result.output.includes('***')).toBe(true);
    if (
      typeof Deno !== 'undefined' &&
      (await Deno.permissions.query({ name: 'write', path: tmpdir() }))
        .state !== 'granted'
    ) {
      return;
    }
    const directory = await mkdtemp(join(tmpdir(), 'publication-options-'));
    try {
      const config = join(directory, 'policy.json');
      const { writeFile } = await import('node:fs/promises');
      await writeFile(config, JSON.stringify({ identityMask: false }));
      const full = await invoke(
        ['redact', '-', '--native-only', '--config', config],
        ['46 21 573918']
      );
      expect(full.output).toBe('[REDACTED]');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('streams records and applies opt-in compatible masking', async () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    const result = await invoke(
      ['redact', '-', '--stream', '--native-only', '--hive-mask'],
      ['password: abcdefghijklmnop\n', 'name: John Smith\n']
    );
    expect(result.status).toBe(0);
    expect(result.output).toBe('password: abc…nop\nname: [REDACTED]\n');
  });
  it('publishes nothing after late malformed input and cleans private spool files', async () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    const directory = await mkdtemp(join(tmpdir(), 'stream-cli-'));
    try {
      const output = join(directory, 'result');
      const result = await invoke(
        ['redact', '-', '--stream', '--native-only', '--output', output],
        ['ordinary\n'.repeat(40000), Buffer.from([0xc3, 0x28])]
      );
      expect(result.status).toBe(2);
      expect(result.output).toBe('');
      expect(await readdir(directory)).toEqual([]);
      const success = await invoke(
        ['redact', '-', '--stream', '--native-only', '--output', output],
        ['password=short\n']
      );
      expect(success.status).toBe(0);
      expect(await readFile(output, 'utf8')).toBe('password=[REDACTED]\n');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('rejects rewrite/stream flag combinations before publication', async () => {
    for (const args of [
      ['scan', '-', '--stream'],
      ['redact', '-', '--apply'],
      ['history', 'rewrite', '.', '--in-place'],
      ['history', 'rewrite', '.'],
    ]) {
      const result = await invoke(args, ['safe']);
      expect(result.status).toBe(2);
      expect(result.output).toBe('');
    }
  });
});
