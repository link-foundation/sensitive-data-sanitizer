import { itUnless, sandboxed } from './helpers/skip.js';
import { describe, it, expect } from 'test-anywhere';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { runCli } from '../bin/sensitive-data-sanitizer.js';
import {
  createRestoreMap,
  sanitizeStream,
  sanitizeFileBounded,
  restore,
  readRestoreMap,
} from '../src/index.js';

async function cli(args, input = '') {
  let output = '',
    errors = '';
  const code = await runCli(args, {
    stdin: Readable.from([input]),
    stdout: {
      write(chunk) {
        output += chunk;
        return true;
      },
    },
    stderr: {
      write(chunk) {
        errors += chunk;
        return true;
      },
    },
  });
  return { code, output, errors };
}
describe('private map CLI and stream integration', () => {
  for (const extension of ['json', 'lino']) {
    itUnless(sandboxed)(
      `writes a 0600 ${extension} map, reuses it, restores and blocks scanning it`,
      async () => {
        const dir = await mkdtemp(join(tmpdir(), 'placeholder-cli-'));
        try {
          const map = join(dir, `map.${extension}`),
            safe = join(dir, 'safe.txt');
          const first = await cli(
            [
              'redact',
              '-',
              '--native-only',
              '--placeholder',
              '--map',
              map,
              '--output',
              safe,
            ],
            'Jane Doe met jane@private.test'
          );
          expect(first.code).toBe(0);
          expect(first.output).toBe('');
          if (process.platform !== 'win32') {
            expect((await stat(map)).mode & 0o777).toBe(0o600);
          }
          const second = await cli(
            ['redact', '-', '--native-only', '--placeholder', '--map', map],
            'John Smith met Jane Doe'
          );
          expect(second.output).toBe('Person-2 met Person-1');
          const restored = await cli(['restore', safe, '--map', map]);
          expect(restored.output).toBe('Jane Doe met jane@private.test');
          expect((await cli(['scan', map, '--native-only'])).code).toBe(2);
          expect((await cli(['redact', map, '--native-only'])).code).toBe(2);
          expect(
            (
              await cli([
                'redact',
                safe,
                '--placeholder',
                '--map',
                safe,
                '--native-only',
              ])
            ).code
          ).toBe(2);
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }
    );
  }
  it('requires explicit CLI map retention or discard, with no map in stdout', async () => {
    expect(
      (await cli(['redact', '--placeholder', '--native-only'], 'Jane Doe')).code
    ).toBe(2);
    const result = await cli(
      ['redact', '--placeholder', '--no-map', '--native-only'],
      'Jane Doe'
    );
    expect(result.code).toBe(0);
    expect(result.output).toBe('Person-1');
  });
  it('uses one ordered registry across tiny JSONL batches even when workers are requested', async () => {
    const map = createRestoreMap();
    const source = [
      '{"text":"Jane Doe"}\n',
      '{"text":"John Smith met Jane Doe"}\n',
    ];
    let text = '';
    for await (const part of sanitizeStream(Readable.from(source), {
      structured: 'jsonl',
      secretlint: false,
      workers: 4,
      batchBytes: 1,
      transformation: { mode: 'placeholder', map },
    })) {
      text += part;
    }
    expect(text).toBe(
      '{"text":"Person-1"}\n{"text":"Person-2 met Person-1"}\n'
    );
    expect(restore(`${text.split('\n')[0]}\n`, map)).toBe(source[0]);
  });
  itUnless(sandboxed)(
    'keeps the caller map updated through the bounded file API and CLI streaming',
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'placeholder-stream-'));
      try {
        const source = join(dir, 'input.txt'),
          target = join(dir, 'output.txt'),
          mapPath = join(dir, 'map.json');
        await writeFile(source, 'Jane Doe\nJohn Smith met Jane Doe');
        const map = createRestoreMap();
        await sanitizeFileBounded(source, target, {
          secretlint: false,
          transformation: { mode: 'placeholder', map },
        });
        const safe = await readFile(target, 'utf8');
        expect(safe).toBe('Person-1\nPerson-2 met Person-1');
        expect(restore(safe, map)).toBe('Jane Doe\nJohn Smith met Jane Doe');
        const result = await cli([
          'redact',
          source,
          '--stream',
          '--native-only',
          '--placeholder',
          '--map',
          mapPath,
        ]);
        expect(result.output).toBe(safe);
        expect(restore(result.output, await readRestoreMap(mapPath))).toBe(
          'Jane Doe\nJohn Smith met Jane Doe'
        );
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
  );
});

it('restores complete streams with different original surfaces in identical batches', async () => {
  for (const structured of [undefined, 'jsonl']) {
    const source = structured
      ? ['{"text":"Jane Doe"}\n', '{"text":"J. Doe"}\n', '{"text":"Doe"}\n']
      : ['Jane Doe\n', 'J. Doe\n', 'Doe\n'];
    const map = createRestoreMap();
    let text = '';
    for await (const chunk of sanitizeStream(Readable.from(source), {
      secretlint: false,
      structured,
      batchBytes: 1,
      transformation: { mode: 'placeholder', map },
    })) {
      text += chunk;
    }
    expect(text.includes('Doe')).toBe(false);
    expect(restore(text, map)).toBe(source.join(''));
  }
});
