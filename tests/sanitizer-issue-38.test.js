import { describe, it, expect } from 'test-anywhere';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inspect,
  sanitize,
  createSanitizer,
  sanitizeStreamToFile,
} from '../src/index.js';
import { issue38Cases, jsonl } from './fixtures/issue-38-sessions.mjs';

const publication = { structured: 'jsonl', profile: 'publication' };
function verify(input, text, fixture) {
  const records = text.trim().split('\n').map(JSON.parse);
  expect(records.length).toBe(fixture.records.length);
  expect(inspect(text, publication)).toEqual([]);
  if (!fixture.sensitive) {
    expect(text).toBe(input);
    return;
  }
  for (const value of fixture.sensitive) {
    expect(text.includes(value)).toBe(false);
  }
  expect(text.includes('[REDACTED]')).toBe(true);
}
async function writable() {
  return (
    typeof Deno === 'undefined' ||
    (await Deno.permissions.query({ name: 'write', path: tmpdir() })).state ===
      'granted'
  );
}

describe('issue 38 public session reproductions', () => {
  for (const fixture of issue38Cases) {
    const input = jsonl(fixture.records);
    it(`publishes ${fixture.name} through sanitize and sanitizeJsonl`, async () => {
      verify(input, sanitize(input, publication).text, fixture);
      const engine = createSanitizer(publication);
      verify(input, (await engine.sanitize(input)).text, fixture);
      verify(
        input,
        (await createSanitizer({ profile: 'publication' }).sanitizeJsonl(input))
          .text,
        fixture
      );
    });
    for (const twoPass of [false, true]) {
      it(`publishes ${fixture.name} to a file (twoPass ${twoPass})`, async () => {
        if (!(await writable())) {
          return;
        }
        const directory = await mkdtemp(join(tmpdir(), 'issue-38-'));
        try {
          const target = join(directory, 'published.jsonl');
          await sanitizeStreamToFile(
            fixture.records.map((record) => jsonl([record])),
            target,
            { ...publication, twoPass, workers: 1, batchBytes: 1 }
          );
          verify(input, await readFile(target, 'utf8'), fixture);
          expect(await readdir(directory)).toEqual(['published.jsonl']);
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      });
    }
  }
});

describe('issue 38 credential label boundaries', () => {
  for (const text of [
    'token for ES.\nes u',
    'token for ES.\\nes u',
    'SIG for\\n:sig is d',
    'sig is d',
    'the token is valid until it expires',
    'the secret is out',
    'a cookie is stored',
    'token for\\ery record. The enclosing request-log write lock serio',
    'API key for\\nlater: value',
  ]) {
    it(`treats prose ${JSON.stringify(text)} as text`, () => {
      expect(
        inspect(text, { profile: 'publication' }).filter(
          (f) => f.rule === 'context'
        )
      ).toEqual([]);
      expect(
        sanitize(JSON.stringify({ text }), {
          ...publication,
          structured: 'json',
        }).text
      ).toBe(JSON.stringify({ text }));
    });
  }
  for (const [text, value] of [
    ['the password is hunter2 for the server', 'hunter2'],
    ['api key is ABCDEF1234567890XYZ', 'ABCDEF1234567890XYZ'],
    ['sig is 9fA3kQ7zLmP2', '9fA3kQ7zLmP2'],
    ['the token is fixturePrivateToken42', 'fixturePrivateToken42'],
    ['token for staging: fixture-private-42', 'fixture-private-42'],
    ['пароль от сервера: qwerty123', 'qwerty123'],
    ["sig:'fixture-private-42' tail", 'fixture-private-42'],
    ['APIkey="\\"private_key:9"', 'private_key:9'],
  ]) {
    it(`still redacts ${JSON.stringify(value)} in plain and JSON text`, () => {
      expect(sanitize(text, { profile: 'publication' }).text).not.toContain(
        value
      );
      const result = sanitize(
        jsonl([{ text }, { type: 'next', text: 'tail' }]),
        publication
      );
      expect(result.text).not.toContain(value);
      const [first, second] = result.text.trim().split('\n').map(JSON.parse);
      expect(Object.keys(first)).toEqual(['text']);
      expect(second).toEqual({ type: 'next', text: 'tail' });
    });
  }
  it('stops a quoted credential value at its enclosing JSON string', () => {
    const input = jsonl([
      { payload: { content: [{ text: "sig:' " }, { type: 'a', text: 'b' }] } },
    ]);
    expect(inspect(input, publication)).toEqual([]);
  });
});

describe('issue 38 fixed-point redaction', () => {
  // A detector that only recognizes its value after the first replacement
  // models raw and decoded layers that disagree about a span.
  const detector = {
    detect(text) {
      return [...text.matchAll(/x\[REDACTED\]|fixture-private/g)].map(
        (match) => ({
          start: match.index,
          end: match.index + match[0].length,
          type: 'SECRET',
          category: 'credential',
          rule: 'fixture',
        })
      );
    },
  };
  it('redacts a known value exposed by a replacement in the synchronous API', () => {
    const events = [];
    const options = {
      profile: 'publication',
      knownSecrets: ['fixture-private', 'x[REDACTED]'],
      debug: (event) => events.push(event),
    };
    const result = sanitize('keep xfixture-private keep', options);
    expect(result.text).toBe('keep [REDACTED] keep');
    expect(result.redactions).toBe(2);
    expect(result.findings.length).toBe(1);
    expect(
      events.filter((event) => event.event === 'residual-redaction')
    ).toEqual([{ event: 'residual-redaction', round: 1 }]);
    const structured = sanitize(jsonl([{ text: 'keep xfixture-private' }]), {
      ...options,
      structured: 'jsonl',
    });
    expect(JSON.parse(structured.text).text).toBe('keep [REDACTED]');
  });
  it('redacts a value found again after redaction through the engines', async () => {
    const engine = createSanitizer({
      profile: 'publication',
      secretlint: false,
      detectors: [detector],
    });
    const result = await engine.sanitize('keep xfixture-private keep');
    expect(result.text).toBe('keep [REDACTED] keep');
    expect(result.redactions).toBe(2);
    const records = jsonl([{ text: 'keep xfixture-private keep' }]);
    const jsonResult = await createSanitizer({
      ...publication,
      secretlint: false,
      detectors: [detector],
    }).sanitize(records);
    expect(JSON.parse(jsonResult.text).text).toBe('keep [REDACTED] keep');
  });
  it('still fails closed when redaction never converges', async () => {
    const engine = createSanitizer({
      profile: 'publication',
      secretlint: false,
      detectors: [
        {
          detect: (text) =>
            [...text.matchAll(/\[REDACTED\]|fixture-private/g)].map(
              (match) => ({
                start: match.index,
                end: match.index + match[0].length,
                type: 'SECRET',
                category: 'credential',
                rule: 'fixture',
              })
            ),
        },
      ],
    });
    let code;
    try {
      await engine.sanitize('fixture-private');
    } catch (error) {
      code = error.code;
    }
    expect(code).toBe('ERR_RESIDUAL');
  });
});
