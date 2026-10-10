import { describe, it, expect } from 'test-anywhere';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareStreamEngine } from '../src/engines.js';
import { inspect } from '../src/sanitizer.js';
import {
  createSanitizer,
  sanitizeStream,
  sanitizeStreamToFile,
} from '../src/index.js';

async function collect(text, options) {
  let output = '';
  for await (const chunk of sanitizeStream(text.split(/(?<=\n)/), options)) {
    output += chunk;
  }
  return output;
}
describe('prepared stream findings and verification', () => {
  it('reuses coordinator findings while retaining required engines and final verification', async () => {
    const input = '{"text":"orchid"}\n';
    const options = { structured: 'jsonl', secretlint: false };
    const calls = [];
    const engine = createSanitizer({
      ...options,
      detectors: [
        {
          detect(text) {
            calls.push(text);
            const start = text.indexOf('orchid');
            return start < 0
              ? []
              : [
                  {
                    start,
                    end: start + 6,
                    category: 'credential',
                    type: 'SECRET',
                    rule: 'fixture-engine',
                  },
                ];
          },
        },
      ],
    });
    await prepareStreamEngine(engine, input, inspect(input, options));
    const output = (await engine.sanitize(input)).text;
    expect(output.includes('orchid')).toBe(false);
    expect(JSON.parse(output).text).toBe('[REDACTED]');
    expect(calls.some((text) => text.includes('orchid'))).toBe(true);
    expect(calls.some((text) => text.includes('[REDACTED]'))).toBe(true);
  });
  it('never reuses coordinator findings for residual verification', async () => {
    const input = '{"text":"ordinary"}\n';
    let calls = 0;
    const engine = createSanitizer({
      structured: 'jsonl',
      secretlint: false,
      detectors: [
        {
          detect(text) {
            const start = text.indexOf('ordinary');
            return ++calls === 1
              ? []
              : [
                  {
                    start,
                    end: start + 8,
                    category: 'credential',
                    type: 'SECRET',
                    rule: 'late-engine',
                  },
                ];
          },
        },
      ],
    });
    await prepareStreamEngine(engine, input, []);
    let code;
    try {
      await engine.sanitize(input);
    } catch (error) {
      code = error.code;
    }
    expect(code).toBe('ERR_RESIDUAL');
  });
});
describe('private stream confirmations and publication', () => {
  for (const workers of [1, 4]) {
    it(`protects distant cross-script MRZ reuse in a 1.7 MB session (${workers} workers)`, async () => {
      const input = [
        JSON.stringify({
          text: 'P<RUSZYRYANOVA<<OLESYA<<<<<<<<<<<<<<<<<<<<<<',
        }),
        ...Array.from({ length: 20 }, () =>
          JSON.stringify({ text: 'ordinary output '.repeat(5700) })
        ),
        JSON.stringify({ text: 'saved zyryanova.pdf and файл Зырянова.pdf' }),
      ].join('\n');
      expect(Buffer.byteLength(input) > 1700000).toBe(true);
      const output = await collect(input, { structured: 'jsonl', workers });
      expect(output.toLowerCase().includes('zyryanova')).toBe(false);
      expect(output.includes('Зырянова')).toBe(false);
      expect(output.split('\n').map(JSON.parse).length).toBe(22);
    });
  }
  it('shares confirmations with a supplied sanitizer and plain streams', async () => {
    const input =
      'Applicant: Qazvela Zorveta\nordinary output\nsaved qazvela.pdf\n';
    const output = await collect(input, {
      sanitizer: createSanitizer({ secretlint: false }),
      batchBytes: 1,
    });
    expect(output.toLowerCase().includes('qazvela')).toBe(false);
  });
  it('keeps a confirmed private public-figure namesake private across batches', async () => {
    const input = '{"text":"patient: Sergey Brin"}\n{"text":"Sergey Brin"}\n';
    expect(
      (
        await collect(input, { structured: 'jsonl', workers: 1, batchBytes: 1 })
      ).includes('Sergey Brin')
    ).toBe(false);
  });
  it('does not share identities with another stream', async () => {
    await collect('Applicant: Qazvela Zorveta\n', { batchBytes: 1 });
    expect(await collect('saved qazvela.pdf\n', { batchBytes: 1 })).toBe(
      'saved qazvela.pdf\n'
    );
  });
  it('uses publication thresholds consistently for registry confirmations', async () => {
    const output = await collect('583920471\npassport: 583920471\n', {
      profile: 'publication',
      batchBytes: 1,
    });
    expect(output.includes('583920471')).toBe(false);
  });
  it('fails closed on late numeric confirmation and registry exhaustion', async () => {
    for (const [text, options, code] of [
      [
        '583920471\npassport: 583920471\n',
        { batchBytes: 1 },
        'ERR_LATE_PERSONAL',
      ],
      [
        'qazvela_zorveta\nusername: qazvela_zorveta\n',
        { batchBytes: 1 },
        'ERR_LATE_PERSONAL',
      ],
      [
        'secret garden\naddress: secret garden\n',
        { batchBytes: 1 },
        'ERR_LATE_PERSONAL',
      ],
      ['ordinary distinct words\n', { maxRegistryValues: 1 }, 'ERR_LIMIT'],
      [
        '',
        {
          maxRegistryValues: 1,
          confirmedPersonal: [
            { type: 'PERSON', value: 'Qazvela' },
            { type: 'PERSON', value: 'Zorveta' },
          ],
        },
        'ERR_LIMIT',
      ],
      ['ordinary\n', { maxRegistryValues: 0 }, 'ERR_CONFIG'],
    ]) {
      let actual;
      try {
        await collect(text, options);
      } catch (error) {
        actual = error.code;
      }
      expect(actual).toBe(code);
    }
  });
  it('publishes valid sessions atomically and removes staging on late confirmation', async () => {
    if (
      typeof Deno !== 'undefined' &&
      (await Deno.permissions.query({ name: 'write', path: tmpdir() }))
        .state !== 'granted'
    ) {
      return;
    }
    const directory = await mkdtemp(join(tmpdir(), 'issue-32-identity-'));
    try {
      const success = join(directory, 'success.jsonl');
      await sanitizeStreamToFile(['{"text":"state:\\nt"}\n'], success, {
        structured: 'jsonl',
        workers: 1,
      });
      expect(JSON.parse(await readFile(success, 'utf8')).text).toBe(
        'state:\nt'
      );
      let code;
      try {
        await sanitizeStreamToFile(
          ['{"text":"qazvela.pdf"}\n{"text":"Applicant: Qazvela Zorveta"}\n'],
          join(directory, 'blocked.jsonl'),
          { structured: 'jsonl', workers: 4, batchBytes: 1 }
        );
      } catch (error) {
        code = error.code;
      }
      expect(code).toBe('ERR_LATE_PERSONAL');
      expect(await readdir(directory)).toEqual(['success.jsonl']);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
