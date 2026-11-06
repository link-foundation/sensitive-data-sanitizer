import { describe, it, expect } from 'test-anywhere';
import { itUnless, nodeCliUnavailable } from './helpers/skip.js';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCli } from '../bin/sensitive-data-sanitizer.js';
import { boundedProbe } from './bounded-probe.js';
import {
  sanitize,
  createSanitizer,
  restore,
  sanitizeStream,
  sanitizeFileBounded,
} from '../src/index.js';

const options = {
  profile: 'documents',
  properNames: 'capitalized',
  structured: 'json',
  secretlint: false,
};

describe('structural prose across entry points', () => {
  it('retains uncased-script document entities alongside uppercase prose', async () => {
    const source = 'текст Acme; 蓝天有限公司; جامعة النور';
    const expected = 'текст [REDACTED]; [REDACTED]; [REDACTED]';
    const config = { ...options, structured: undefined };
    expect(sanitize(source, config).text).toBe(expected);
    expect((await createSanitizer(config).sanitize(source)).text).toBe(
      expected
    );
  });
  it('keeps nested serialized JSON keys and isolates its leaves', async () => {
    const nested =
      '{"Ромашка":"текст Acme","operational":"Connection to Acme lost","n":42}';
    const source = JSON.stringify({ envelope: nested });
    const expected = JSON.stringify({
      envelope: nested.replace('текст Acme', 'текст [REDACTED]'),
    });
    expect(sanitize(source, options).text).toBe(expected);
    expect((await createSanitizer(options).sanitize(source)).text).toBe(
      expected
    );
  });
  it('maps escaped Unicode values without rewriting unrelated bytes', () => {
    const source = ' {"note":"\\u0442екст \\u0041cme", "x":1.00e+02} ';
    expect(sanitize(source, options).text).toBe(
      ' {"note":"\\u0442екст [REDACTED]", "x":1.00e+02} '
    );
  });
  it('protects bracketed names and preserves spaced labels', () => {
    expect(
      sanitize('текст [Acme] Label : слово', {
        ...options,
        structured: undefined,
      }).text
    ).toBe('текст [[REDACTED]] Label : слово');
  });
  it('uses the same date grammar for prose and document entries', () => {
    for (const range of [
      'Jan 2019 - Feb 2021',
      '2019 to present',
      '05.2019 — 03.2021',
    ]) {
      expect(
        sanitize(`Founder, Acme (${range})`, {
          ...options,
          structured: undefined,
          scripts: [],
        }).text
      ).toBe(`[REDACTED], [REDACTED] (${range})`);
    }
  });
  it('keeps keys, restores originals and reuses stable placeholders', async () => {
    const source = '{"Ромашка":"текст Acme","n":42}';
    const config = { ...options, transformation: { mode: 'placeholder' } };
    const output = sanitize(source, config);
    expect(Object.keys(JSON.parse(output.text))).toEqual(['Ромашка', 'n']);
    expect(restore(output.text, output.map)).toBe(source);
    expect(
      sanitize(source, {
        ...config,
        transformation: { mode: 'placeholder', map: output.map },
      }).text
    ).toBe(output.text);
    expect((await createSanitizer(config).sanitize(source)).text).toBe(
      output.text
    );
  });
  it('keeps records independent when streaming split JSONL', async () => {
    const source =
      '{"note":"текст Acme","n":42}\n{"note":"Connection to Acme lost","n":43}\n';
    const config = { ...options, structured: 'jsonl', batchBytes: 1 };
    let output = '';
    for await (const chunk of sanitizeStream(
      [source.slice(0, 14), source.slice(14)],
      config
    )) {
      output += chunk;
    }
    expect(output).toBe(source.replace('текст Acme', 'текст [REDACTED]'));
  });
  itUnless(nodeCliUnavailable)(
    'passes configuration to the bounded file worker',
    async () => {
      const directory = await mkdtemp(join(tmpdir(), 'prose-worker-'));
      try {
        const input = join(directory, 'input.jsonl'),
          output = join(directory, 'output.jsonl');
        await writeFile(input, '{"note":"текст Acme","n":42}\n');
        await sanitizeFileBounded(input, output, {
          ...options,
          structured: 'jsonl',
        });
        expect(await readFile(output, 'utf8')).toBe(
          '{"note":"текст [REDACTED]","n":42}\n'
        );
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  );
  it('supports CLI flags and configuration files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'prose-cli-'));
    try {
      const config = join(directory, 'config.json');
      await writeFile(config, JSON.stringify(options));
      for (const args of [
        ['--config', config],
        [
          '--profile',
          'documents',
          '--proper-names',
          'capitalized',
          '--scripts',
          'Latin',
          '--json',
        ],
      ]) {
        let output = '',
          error = '';
        const code = await runCli(['redact', '-', '--native-only', ...args], {
          stdin: ['{"note":"текст Acme","n":42}'],
          stdout: {
            write: (chunk) => {
              output += chunk;
            },
          },
          stderr: {
            write: (chunk) => {
              error += chunk;
            },
          },
        });
        expect(error).toBe('');
        expect(code).toBe(0);
        expect(output).toBe('{"note":"текст [REDACTED]","n":42}');
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  itUnless(nodeCliUnavailable)(
    'bounds hostile tokens and malformed quote costs',
    async () => {
      const result = await boundedProbe('experiments/issue-106/prose-cost.mjs');
      expect(result.maxBytes >= 200000).toBe(true);
      expect(result.milliseconds < 1800).toBe(true);
    }
  );
});
