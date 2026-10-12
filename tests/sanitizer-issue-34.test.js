import { URL } from 'node:url';
import { describe, it, expect } from 'test-anywhere';
import { readFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createSanitizer,
  sanitize,
  sanitizeStream,
  sanitizeStreamToFile,
} from '../src/index.js';
import { confirmedSeeds } from '../src/propagation.js';

const publication = { profile: 'publication', secretlint: false };
const source = (n) =>
  `function parse() {\n  found.phone = number;\n${Array.from({ length: n }, (_, i) => `  const value${i} = compute(${i});`).join('\n')}\n}`;
const prompt = `# Security Policy\n## Environment Profile\n- Organization: default generic organization / personal user.\n${Array.from({ length: 400 }, (_, i) => `- Rule ${i}: apply this policy to the current planned action (${i}).`).join('\n')}`;
async function errorOf(operation) {
  try {
    await operation();
  } catch (error) {
    return error;
  }
}
function canWrite() {
  return typeof Deno === 'undefined';
}

describe('issue 34 session label and propagation regressions', () => {
  for (const content of [source(5), source(900), prompt]) {
    it(`bounds escaped label values in ${content.length}-character tool output`, async () => {
      const input = JSON.stringify({ content });
      for (const options of [
        publication,
        { ...publication, structured: 'jsonl' },
      ]) {
        const result = await createSanitizer(options).sanitize(input);
        expect(
          JSON.parse(result.text).content.includes('apply this policy') ||
            JSON.parse(result.text).content.includes('compute(0)')
        ).toBe(true);
        expect(result.findings.every((f) => f.end - f.start <= 512)).toBe(true);
      }
    });
  }
  for (const text of [
    'found.phone = number;',
    'email: getEmail();',
    'phone: number;',
    'PHONE_NUMBER: found.phone',
    'EMAIL_ADDRESS: emailVariable',
  ]) {
    it(`preserves code value ${text}`, () =>
      expect(sanitize(text, publication).text).toBe(text));
  }
  it('stops real values at escaped newlines and quotes', () => {
    const input = JSON.stringify({
      content:
        'phone: +1 202 555 0198\nemail: zoe@private.invalid\nconst keep = "safe";',
    });
    const result = sanitize(input, publication);
    expect(
      JSON.parse(result.text).content.endsWith('const keep = "safe";')
    ).toBe(true);
    expect(result.text.includes('zoe@private.invalid')).toBe(false);
    expect(result.text.includes('202 555 0198')).toBe(false);
  });
  it('never seeds oversized detector values', () => {
    const text = 'Zorina '.repeat(1000);
    const findings = [
      {
        start: 0,
        end: text.length,
        type: 'PERSON',
        category: 'personal',
        confidence: 0.95,
        rule: 'fixture',
      },
    ];
    expect(confirmedSeeds(text, findings, publication).size).toBe(0);
  });
  it('stops quoted personal labels at raw and escaped line breaks', () => {
    const content = `Applicant: "Qazvela Zorveta\n${source(5)}"`;
    expect(sanitize(content, publication).text.includes('compute(0)')).toBe(
      true
    );
    const result = sanitize(JSON.stringify({ content }), publication);
    expect(JSON.parse(result.text).content.includes('compute(0)')).toBe(true);
    expect(result.text.includes('Qazvela')).toBe(false);
  });
  it('escapes punctuation before joining flexible name separators', () => {
    const input = 'Applicant: Zo-rina Velenska\nSaved Zo_rina Velenska.pdf';
    expect(sanitize(input, publication).text.includes('Zo_rina')).toBe(false);
  });
});

describe('issue 34 structured keys and public CI metadata', () => {
  for (const text of [
    'root_turn_id',
    'other_turn_id',
    'test_runner',
    'runner_temp',
  ]) {
    it(`keeps ordinary identifier ${text}`, () =>
      expect(sanitize(text, publication).text).toBe(text));
  }
  it('keeps distinct ordinary JSON keys without losing credential or personal keys', async () => {
    const input = JSON.stringify({
      payload: { root_turn_id: 'x', other_turn_id: 'y', turn_id: 'z' },
    });
    expect(
      (
        await createSanitizer({ ...publication, structured: 'jsonl' }).sanitize(
          input
        )
      ).text
    ).toBe(input);
    const sensitive = JSON.stringify({ 'Marina Kovaleva': 'secret-name-key' });
    expect(
      (
        await createSanitizer({ ...publication, structured: 'jsonl' }).sanitize(
          sensitive
        )
      ).text.includes('Kovaleva')
    ).toBe(false);
  });
  it('protects identifier keys after a matching name is confirmed in a value', async () => {
    const input = {
      root_turn_id: 'x',
      other_turn_id: 'y',
      text: 'Applicant: Root Turn',
    };
    const result = await createSanitizer({
      ...publication,
      structured: 'jsonl',
    }).sanitize(JSON.stringify(input));
    const output = JSON.parse(result.text);
    expect(output.root_turn_id).toBe('x');
    expect(output.other_turn_id).toBe('y');
    expect(output.text.includes('Root Turn')).toBe(false);
  });
  for (const account of [
    'runner',
    'ubuntu',
    'vsts',
    'circleci',
    'node',
    'root',
  ]) {
    it(`keeps service-account ${account} paths`, () => {
      const input = `/home/${account}/work/example-repo/test.js\nnode:internal/test_runner/test:835:12\n/github/runner_temp/file`;
      expect(sanitize(input, publication).text).toBe(input);
    });
  }
  it('still protects personal home directory names', () =>
    expect(
      sanitize('/home/zorveta/private', publication).text.includes('zorveta')
    ).toBe(false));
  it('publishes the complete reported public CI log without residuals', async () => {
    const fixture = await readFile(
      new URL('./fixtures/issue-34-ci.json', import.meta.url),
      'utf8'
    );
    const input = `${JSON.stringify(JSON.parse(fixture))}\n`;
    const result = await createSanitizer({
      profile: 'publication',
      structured: 'jsonl',
    }).sanitize(input);
    expect(JSON.parse(result.text).payload.item.aggregated_output).toBe(
      JSON.parse(input).payload.item.aggregated_output
    );
  });
  it('keeps escaped lone surrogates alongside redactions', async () => {
    const text = 'emoji 😀 lone \ud83d and \udc00\nemail: zoe@private.invalid';
    const result = await createSanitizer({
      profile: 'publication',
      structured: 'jsonl',
      preserveEncoding: true,
    }).sanitize(JSON.stringify({ text }));
    expect(
      JSON.parse(result.text).text.startsWith('emoji 😀 lone \ud83d and \udc00')
    ).toBe(true);
    expect(result.text.includes('zoe@private.invalid')).toBe(false);
  });
  it('wraps internal callback exceptions without exposing text', async () => {
    const error = await errorOf(() =>
      createSanitizer({
        ...publication,
        debug: () => {
          throw new SyntaxError('private details');
        },
      }).sanitize('ordinary')
    );
    expect(error.code).toBe('ERR_SANITIZATION');
    expect(error.message.includes('private details')).toBe(false);
  });
});

describe('issue 34 two-pass atomic publication', () => {
  for (const workers of [1, 4]) {
    it(`redacts earlier values with ${workers} workers from a one-shot source`, async () => {
      if (!canWrite()) {
        return;
      }
      const dir = await mkdtemp(join(tmpdir(), 'issue-34-'));
      const input = [
        '{"text":"saved qazvela.pdf"}\n',
        '{"text":"Applicant: Qazvela Zorveta"}\n',
      ];
      let consumed = 0;
      async function* oneShot() {
        for (const line of input) {
          consumed++;
          yield line;
        }
      }
      try {
        const target = join(dir, 'published.jsonl');
        await sanitizeStreamToFile(oneShot(), target, {
          ...publication,
          structured: 'jsonl',
          twoPass: true,
          workers,
          batchBytes: 1,
        });
        const output = await readFile(target, 'utf8');
        expect(consumed).toBe(2);
        expect(output.toLowerCase().includes('qazvela')).toBe(false);
        expect(output.trim().split('\n').map(JSON.parse).length).toBe(2);
        expect(await readdir(dir)).toEqual(['published.jsonl']);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  }
  it('reports record and byte offsets for malformed UTF-8', async () => {
    const bytes = Buffer.concat([
      Buffer.from('{}\n{"text":"'),
      Buffer.from([0xff]),
      Buffer.from('"}\n'),
    ]);
    const error = await errorOf(async () => {
      for await (const chunk of sanitizeStream([bytes], {
        ...publication,
        structured: 'jsonl',
        workers: 1,
      })) {
        void chunk;
      }
    });
    expect(error.code).toBe('ERR_ENCODING');
    expect(error.record).toBe(2);
    expect(error.offset).toBe(12);
  });
  it('cleans both passes and preserves an existing target on failure', async () => {
    if (!canWrite()) {
      return;
    }
    const dir = await mkdtemp(join(tmpdir(), 'issue-34-failure-'));
    try {
      const target = join(dir, 'published.jsonl');
      await sanitizeStreamToFile(['{}\n'], target, {
        ...publication,
        structured: 'jsonl',
        workers: 1,
      });
      const error = await errorOf(() =>
        sanitizeStreamToFile(['{}\n{'], target, {
          ...publication,
          structured: 'jsonl',
          twoPass: true,
          replace: true,
          workers: 1,
        })
      );
      expect(error.code).toBe('ERR_JSON');
      expect(await readFile(target, 'utf8')).toBe('{}\n');
      expect(await readdir(dir)).toEqual(['published.jsonl']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
