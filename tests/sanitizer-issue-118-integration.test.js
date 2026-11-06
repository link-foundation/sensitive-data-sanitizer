import { describe, it, expect } from 'test-anywhere';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  sanitizeStream,
  sanitizeFileBounded,
  compileKnown,
} from '../src/index.js';
import { runCli } from '../bin/sensitive-data-sanitizer.js';
import { itUnless, nodeCliUnavailable } from './helpers/skip.js';

async function stream(input, options) {
  const parts = [];
  for await (const part of sanitizeStream([input], options)) {
    parts.push(part);
  }
  return parts.join('');
}
describe('custom policies across stream, worker and CLI entry points', () => {
  it('keeps transformation callbacks in the JSONL coordinator', async () => {
    const input = '{"msg":"Анна Смирнова","n":1}\n';
    const sanitizerOptions = {
      structured: 'jsonl',
      secretlint: false,
      transformation: async () => 'PersonAlias',
    };
    expect(await stream(input, { sanitizerOptions })).toBe(
      '{"msg":"PersonAlias","n":1}\n'
    );
    let code;
    try {
      await stream(input, { sanitizerOptions, workers: 2 });
    } catch (error) {
      code = error.code;
    }
    expect(code).toBe('ERR_CONFIG');
  });
  itUnless(nodeCliUnavailable)(
    'uses callbacks in bounded file publication and rehydrates compiled worker lists',
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'custom-policies-'));
      try {
        const source = join(dir, 'in.txt');
        await writeFile(source, 'arbitrary Ромашка');
        const knownPersonal = compileKnown([
          { type: 'ORGANIZATION', value: 'Ромашка' },
        ]);
        for (const [name, transformation, expected] of [
          ['callback', () => 'PrivateCompany', 'arbitrary PrivateCompany'],
          ['worker', undefined, 'arbitrary [REDACTED]'],
        ]) {
          const target = join(dir, name);
          await sanitizeFileBounded(source, target, {
            sanitizerOptions: {
              secretlint: false,
              knownPersonal,
              transformation,
            },
          });
          expect(await readFile(target, 'utf8')).toBe(expected);
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
  );
  it('applies JSON configuration through the CLI', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'custom-cli-'));
    try {
      const source = join(dir, 'input.json');
      const config = join(dir, 'config.json');
      await writeFile(
        source,
        '{"msg":"работаю в артели Лютик","location":"apps/api","private":"text","n":1}'
      );
      await writeFile(
        config,
        JSON.stringify({
          profile: 'documents',
          structured: 'json',
          secretlint: false,
          vocabulary: { organizationCues: ['артель'] },
          fields: { location: 'scan' },
          allowedFields: ['msg', 'location'],
        })
      );
      let output = '';
      const status = await runCli(['redact', source, '--config', config], {
        stdout: {
          write: (value) => {
            output += value;
          },
        },
        stderr: { write: () => {} },
      });
      expect(status).toBe(0);
      expect(JSON.parse(output)).toEqual({
        msg: 'работаю в артели [REDACTED]',
        location: 'apps/api',
        private: '[REDACTED]',
        n: 1,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
