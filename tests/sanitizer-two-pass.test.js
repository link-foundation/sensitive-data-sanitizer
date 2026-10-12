import { describe, it, expect } from 'test-anywhere';
import {
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  rm,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import {
  sanitizeStream,
  sanitizeStreamToFile,
  sanitizeFileBounded,
} from '../src/index.js';
import { runCli } from '../bin/sensitive-data-sanitizer.js';

const policy = {
  profile: 'publication',
  secretlint: false,
  workers: 1,
  batchBytes: 1,
};
async function errorOf(operation) {
  try {
    await operation();
  } catch (error) {
    return error;
  }
}
async function inDirectory(operation) {
  if (typeof Deno !== 'undefined') {
    return;
  }
  const directory = await mkdtemp(join(tmpdir(), 'two-pass-'));
  try {
    await operation(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
async function cli(args, chunks) {
  let output = '',
    errors = '';
  const status = await runCli(args, {
    stdin: Readable.from(chunks),
    stdout: {
      write(text) {
        output += text;
      },
    },
    stderr: {
      write(text) {
        errors += text;
      },
    },
  });
  return { status, output, errors };
}

describe('two-pass publication bounds and verification', () => {
  it('wraps unexpected source failures and removes the private snapshot', () =>
    inDirectory(async (dir) => {
      async function* source() {
        yield '{}\n';
        throw null;
      }
      const error = await errorOf(() =>
        sanitizeStreamToFile(source(), join(dir, 'result'), {
          ...policy,
          structured: 'jsonl',
          twoPass: true,
        })
      );
      expect(error.code).toBe('ERR_SANITIZATION');
      expect(await readdir(dir)).toEqual([]);
    }));
  it('supports plain text and privately snapshots a one-shot input', () =>
    inDirectory(async (dir) => {
      async function* source() {
        yield 'saved qazvela.pdf\n';
        const files = await readdir(dir);
        const spool = files.find((file) => file.endsWith('.input'));
        expect(Boolean(spool)).toBe(true);
        if (process.platform !== 'win32') {
          expect((await stat(join(dir, spool))).mode & 0o777).toBe(0o600);
        }
        yield 'Applicant: Qazvela Zorveta\n';
      }
      await sanitizeStreamToFile(source(), join(dir, 'result'), {
        ...policy,
        twoPass: true,
      });
      expect(
        (await readFile(join(dir, 'result'), 'utf8')).includes('qazvela')
      ).toBe(false);
      expect(await readdir(dir)).toEqual(['result']);
    }));
  for (const bound of [
    { maxTotalBytes: 10 },
    { maxRecordBytes: 10 },
    { maxRegistryValues: 1 },
  ]) {
    it(`blocks and cleans an exceeded ${Object.keys(bound)[0]} bound`, () =>
      inDirectory(async (dir) => {
        const error = await errorOf(() =>
          sanitizeStreamToFile(
            ['{"text":"Applicant: Qazvela Zorveta"}\n'],
            join(dir, 'result'),
            { ...policy, structured: 'jsonl', twoPass: true, ...bound }
          )
        );
        expect(error.code).toBe('ERR_LIMIT');
        expect(await readdir(dir)).toEqual([]);
      }));
  }
  it('keeps required detectors in discovery, redaction, and residual verification', () =>
    inDirectory(async (dir) => {
      const calls = [];
      const detector = {
        detect(text) {
          calls.push(text);
          const start = text.indexOf('orchid');
          return start < 0
            ? []
            : [
                {
                  start,
                  end: start + 6,
                  type: 'SECRET',
                  category: 'credential',
                  rule: 'fixture',
                },
              ];
        },
      };
      await sanitizeStreamToFile(['{"text":"orchid"}\n'], join(dir, 'result'), {
        ...policy,
        structured: 'jsonl',
        twoPass: true,
        detectors: [detector],
      });
      expect(calls.filter((text) => text.includes('orchid')).length >= 2).toBe(
        true
      );
      expect(calls.some((text) => text.includes('[REDACTED]'))).toBe(true);
      expect(
        (await readFile(join(dir, 'result'), 'utf8')).includes('orchid')
      ).toBe(false);
    }));
  it('rejects two-pass mode on the incremental output API', async () => {
    const error = await errorOf(async () => {
      for await (const chunk of sanitizeStream(['{}\n'], { twoPass: true })) {
        void chunk;
      }
    });
    expect(error.code).toBe('ERR_CONFIG');
  });
  it('preserves malformed UTF-8 locations across the bounded file worker', () =>
    inDirectory(async (dir) => {
      const input = join(dir, 'input');
      await writeFile(
        input,
        Buffer.concat([
          Buffer.from('{}\n{"text":"'),
          Buffer.from([0xed, 0xa0, 0x80]),
          Buffer.from('"}\n'),
        ])
      );
      const error = await errorOf(() =>
        sanitizeFileBounded(input, join(dir, 'result'), {
          ...policy,
          structured: 'jsonl',
          twoPass: true,
        })
      );
      expect(error.code).toBe('ERR_ENCODING');
      expect(error.record).toBe(2);
      expect(error.offset).toBe(12);
      expect(error.recordOffset).toBe(9);
      expect(await readdir(dir)).toEqual(['input']);
    }));
});

describe('two-pass CLI publication', () => {
  it('publishes earlier aliases from stdin with a completed registry', async () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    const result = await cli(
      ['redact', '-', '--native-only', '--stream', '--jsonl', '--two-pass'],
      [
        '{"text":"saved qazvela.pdf"}\n',
        '{"text":"Applicant: Qazvela Zorveta"}\n',
      ]
    );
    expect(result.status).toBe(0);
    expect(result.errors).toBe('');
    expect(result.output.toLowerCase().includes('qazvela')).toBe(false);
    expect(result.output.trim().split('\n').map(JSON.parse).length).toBe(2);
  });
  it('reports encoding locations and emits no partial stdout', async () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    const result = await cli(
      ['redact', '-', '--native-only', '--stream', '--jsonl', '--two-pass'],
      [
        Buffer.concat([
          Buffer.from('{}\n{"text":"'),
          Buffer.from([0xff]),
          Buffer.from('"}\n'),
        ]),
      ]
    );
    expect(result.status).toBe(2);
    expect(result.output).toBe('');
    expect(result.errors.includes('ERR_ENCODING; record 2, byte 12')).toBe(
      true
    );
  });
  it('requires --stream when --two-pass is requested', async () => {
    const result = await cli(['redact', '-', '--two-pass'], ['ordinary']);
    expect(result.status).toBe(2);
    expect(result.output).toBe('');
    expect(result.errors.includes('ERR_ARGUMENT')).toBe(true);
  });
});
