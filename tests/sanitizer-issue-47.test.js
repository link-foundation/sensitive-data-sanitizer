import { describe, it, expect } from 'test-anywhere';
import { Readable } from 'node:stream';
import { setInterval, clearInterval } from 'node:timers';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  sanitizeStream,
  sanitizeStreamToFile,
  sanitizeFileBounded,
  inspect,
} from '../src/index.js';
import { runCli } from '../bin/sensitive-data-sanitizer.js';

async function collect(chunks, options = {}) {
  let result = '';
  for await (const chunk of sanitizeStream(chunks, {
    secretlint: false,
    credentialsOnly: true,
    ...options,
  })) {
    result += chunk;
  }
  return result;
}
async function invoke(args, chunks = []) {
  let output = '',
    errors = '';
  const status = await runCli(args, {
    stdin: Readable.from(chunks),
    stdout: {
      write: (v) => {
        output += v;
      },
    },
    stderr: {
      write: (v) => {
        errors += v;
      },
    },
  });
  return { status, output, errors };
}
it('provides optional rule timings without copying credential values', () => {
  const events = [];
  const text = 'password: a-value-for-timing-only';
  const result = inspect(text, { debug: (event) => events.push(event) });
  const rules = events.filter((event) => event.event === 'gitleaks-rule');
  expect(result.length > 0).toBe(true);
  expect(rules.length > 0).toBe(true);
  expect(JSON.stringify(events).includes('a-value-for-timing-only')).toBe(
    false
  );
  for (const event of rules) {
    expect(Object.keys(event).sort()).toEqual([
      'event',
      'length',
      'ms',
      'rule',
    ]);
    expect(event.length).toBe(text.length);
    expect(event.ms >= 0).toBe(true);
  }
});
describe('large log controls (issue 47)', () => {
  it('preserves opted-in NUL bytes and redacts credentials at every split', async () => {
    const input = Buffer.from('line one\n\0line two\npassword: hunter2\n');
    for (let i = 1; i < input.length; i++) {
      expect(
        await collect([input.subarray(0, i), input.subarray(i)], {
          allowBinary: true,
        })
      ).toBe('line one\n\0line two\npassword: [REDACTED]\n');
    }
    let code;
    try {
      await collect([input]);
    } catch (e) {
      code = e.code;
    }
    expect(code).toBe('ERR_BINARY');
  });
  it('validates the binary option and keeps JSONL strict', async () => {
    for (const options of [
      { allowBinary: 'yes' },
      { allowBinary: true, structured: 'jsonl' },
      { allowBinary: true, structured: 'json' },
    ]) {
      let code;
      try {
        await collect(['{}\n'], options);
      } catch (e) {
        code = e.code;
      }
      expect(code).toBe('ERR_CONFIG');
    }
  });
  it('publishes NUL logs through workers and two passes atomically', async () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    const dir = await mkdtemp(join(tmpdir(), 'issue-47-'));
    try {
      const source = join(dir, 'input');
      await writeFile(source, 'before\0\npassword: hunter2\nafter\n');
      for (const twoPass of [false, true]) {
        const target = join(dir, `output-${twoPass}`);
        await sanitizeFileBounded(source, target, {
          allowBinary: true,
          twoPass,
          secretlint: false,
          credentialsOnly: true,
        });
        expect(await readFile(target, 'utf8')).toBe(
          'before\0\npassword: [REDACTED]\nafter\n'
        );
      }
      let code;
      try {
        await sanitizeStreamToFile(['safe\n', '\0'], join(dir, 'blocked'));
      } catch (e) {
        code = e.code;
      }
      expect(code).toBe('ERR_BINARY');
      expect((await readdir(dir)).sort()).toEqual([
        'input',
        'output-false',
        'output-true',
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('supports CLI NUL opt-in in whole-input and streaming file/stdin paths', async () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    const dir = await mkdtemp(join(tmpdir(), 'issue-47-cli-'));
    const input = 'before\0\npassword: hunter2\nafter\n';
    try {
      const source = join(dir, 'input');
      await writeFile(source, input);
      for (const path of ['-', source]) {
        for (const flags of [[], ['--stream']]) {
          const result = await invoke(
            ['redact', path, '--credentials-only', '--allow-binary', ...flags],
            [input]
          );
          expect(result).toEqual({
            status: 0,
            output: 'before\0\npassword: [REDACTED]\nafter\n',
            errors: '',
          });
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('supports a configurable CLI worker deadline and rejects invalid values', async () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    const dir = await mkdtemp(join(tmpdir(), 'issue-47-deadline-'));
    try {
      const source = join(dir, 'input');
      await writeFile(source, 'password: hunter2\n');
      expect(
        (
          await invoke([
            'redact',
            source,
            '--stream',
            '--worker-timeout-ms',
            '120000',
          ])
        ).status
      ).toBe(0);
      const timedOut = await invoke([
        'redact',
        source,
        '--stream',
        '--worker-timeout-ms',
        '1',
      ]);
      expect(timedOut.status).toBe(2);
      expect(timedOut.errors.includes('ERR_WORKER')).toBe(true);
      expect(timedOut.output).toBe('');
      for (const args of [
        ['redact', '-', '--stream', '--worker-timeout-ms', '0'],
        ['redact', '-', '--stream', '--worker-timeout-ms', '-1'],
        ['redact', '-', '--stream', '--worker-timeout-ms', 'abc'],
        ['redact', '-', '--worker-timeout-ms', '100'],
        ['redact', '-', '--allow-binary', '--json'],
      ]) {
        expect((await invoke(args, ['safe'])).status).toBe(2);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

it('renews the file deadline on progress and still fails a stalled worker', async () => {
  const { EventEmitter } = await import('node:events');
  const { workerResult } = await import('../src/file-worker-result.js');
  const worker = new EventEmitter();
  const pending = workerResult(worker, 100);
  const progress = setInterval(
    () => worker.emit('message', { progress: true }),
    20
  );
  try {
    await new Promise((resolve) => setTimeout(resolve, 250));
    worker.emit('message', { value: { outputBytes: 42 } });
    expect(await pending).toEqual({ outputBytes: 42 });
  } finally {
    clearInterval(progress);
  }
  let code;
  try {
    await workerResult(new EventEmitter(), 10);
  } catch (e) {
    code = e.code;
  }
  expect(code).toBe('ERR_WORKER');
});
