import { describe, it, expect } from 'test-anywhere';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inspect,
  sanitize,
  createSanitizer,
  sanitizeStreamToFile,
} from '../src/index.js';
import { streamIdentity } from '../src/stream-identity.js';
import { issue36Cases, jsonl } from './fixtures/issue-36-sessions.mjs';

const publication = { structured: 'jsonl', profile: 'publication' };
function verify(input, result, fixture) {
  const records = result.text.trim().split('\n').map(JSON.parse);
  expect(records.length).toBe(fixture.records.length);
  expect(inspect(result.text, publication)).toEqual([]);
  if (!fixture.sensitive) {
    expect(result.text).toBe(input);
  } else if (Array.isArray(fixture.sensitive)) {
    for (const value of fixture.sensitive) {
      expect(result.text.includes(value)).toBe(false);
    }
    expect(result.redactions > 0).toBe(true);
  }
}

describe('issue 36 public session reproductions', () => {
  for (const fixture of issue36Cases) {
    const input = jsonl(fixture.records);
    it(`publishes ${fixture.name} through native and required engines`, async () => {
      verify(input, sanitize(input, publication), fixture);
      const engine = createSanitizer(publication);
      const result = await engine.sanitize(input);
      verify(input, result, fixture);
      expect(await engine.inspect(result.text)).toEqual([]);
    });
    for (const workers of [1]) {
      it(`publishes ${fixture.name} across two-pass batches (${workers} workers)`, async () => {
        if (
          typeof Deno !== 'undefined' &&
          (await Deno.permissions.query({ name: 'write', path: tmpdir() }))
            .state !== 'granted'
        ) {
          return;
        }
        const directory = await mkdtemp(join(tmpdir(), 'issue-36-'));
        try {
          const target = join(directory, 'published.jsonl');
          await sanitizeStreamToFile(
            fixture.records.map((record) => jsonl([record])),
            target,
            {
              ...publication,
              twoPass: true,
              workers,
              batchBytes: 1,
            }
          );
          const text = await readFile(target, 'utf8');
          verify(
            input,
            { text, redactions: text.includes('[REDACTED]') ? 1 : 0 },
            fixture
          );
          expect(await createSanitizer(publication).inspect(text)).toEqual([]);
          expect(await readdir(directory)).toEqual(['published.jsonl']);
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      });
    }
  }
  it('publishes the complete reproductions with four ordered workers', async () => {
    if (
      typeof Deno !== 'undefined' &&
      (await Deno.permissions.query({ name: 'write', path: tmpdir() }))
        .state !== 'granted'
    ) {
      return;
    }
    const directory = await mkdtemp(join(tmpdir(), 'issue-36-workers-'));
    try {
      const target = join(directory, 'published.jsonl');
      const records = issue36Cases.flatMap((fixture) => fixture.records);
      await sanitizeStreamToFile(
        records.map((record) => jsonl([record])),
        target,
        { ...publication, twoPass: true, workers: 4, batchBytes: 1 }
      );
      const text = await readFile(target, 'utf8');
      const lines = text.trim().split('\n');
      let offset = 0;
      for (const fixture of issue36Cases) {
        const output = `${lines.slice(offset, offset + fixture.records.length).join('\n')}\n`;
        verify(
          jsonl(fixture.records),
          { text: output, redactions: output.includes('[REDACTED]') ? 1 : 0 },
          fixture
        );
        offset += fixture.records.length;
      }
      expect(lines.length).toBe(records.length);
      expect(await createSanitizer(publication).inspect(text)).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('issue 36 label boundaries', () => {
  for (const value of [
    'Fax:0281234567',
    'ĐT 028 12 345 678',
    'fax: 028 12 345 678',
    'tel:112',
    'tel:+84812345678',
  ]) {
    it(`protects phone context ${value}`, () => {
      const result = sanitize(value, { profile: 'publication' });
      expect(result.text.includes('[REDACTED]')).toBe(true);
      expect(/\d/.test(result.text)).toBe(false);
    });
  }
  for (const value of [
    '.[0].status',
    '==',
    'check',
    'completed',
    'null',
    'state',
  ]) {
    it(`does not confirm state code ${value}`, () => {
      expect(inspect(`state:${value}`, { profile: 'publication' })).toEqual([]);
    });
  }
  for (const value of ['California', 'New York', 'CA', 'Québec', '東京都']) {
    it(`still protects labelled place ${value}`, () => {
      expect(sanitize(`state:${value}`, { profile: 'publication' }).text).toBe(
        'state:[REDACTED]'
      );
    });
  }
  for (const value of [
    'null',
    'true',
    'false',
    'undefined',
    'codec',
    'Coding',
    'Claude',
    'Codex',
    '...',
    'name',
    ':{',
    '==',
    'check',
  ]) {
    it(`does not confirm name token ${value}`, () => {
      for (const label of ['name:', 'name=', 'nom:', 'PERSON_NAME:']) {
        const text = label + value;
        expect(inspect(text, { profile: 'publication' })).toEqual([]);
      }
    });
  }
  for (const value of [
    'John Smith',
    'Qazvela Zorveta',
    'Zo-rina Velenska',
    'Иван Петров',
    '山田太郎',
    'محمد علي',
  ]) {
    it(`still confirms plausible person ${value}`, () => {
      const result = sanitize(JSON.stringify({ name: value }), {
        ...publication,
        structured: 'json',
      });
      expect(JSON.parse(result.text).name.includes(value)).toBe(false);
    });
  }
});

describe('issue 36 propagation and encoding boundaries', () => {
  it('confines inferred propagation to string contents even for punctuation and literals', () => {
    const input =
      '{"null":null,"true":true,"payload":{"text":"null true :{"},"other":"null"}';
    const result = sanitize(input, {
      ...publication,
      structured: 'json',
      confirmedPersonal: [
        { type: 'STATE', value: 'null' },
        { type: 'STATE', value: 'true' },
        { type: 'STATE', value: ':{' },
      ],
    });
    const output = JSON.parse(result.text);
    expect(output.null).toBe(null);
    expect(output.true).toBe(true);
    expect(output.payload.text).toBe('[REDACTED] [REDACTED] [REDACTED]');
    expect(output.other).toBe('[REDACTED]');
  });
  it('canonicalizes whitespace before comparing stream confirmations', () => {
    const discovery = streamIdentity({ secretlint: false }, 100, true);
    const finding = {
      start: 0,
      end: 11,
      type: 'STATE',
      category: 'personal',
      rule: 'fixture',
      confidence: 0.95,
    };
    discovery.prepare('California ', [finding]);
    const redaction = streamIdentity(discovery.options);
    redaction.prepare('California', []);
    assert.doesNotThrow(() =>
      redaction.prepare('California', [
        { ...finding, end: 10, rule: 'known-personal' },
      ])
    );
    expect(redaction.options.confirmedPersonal.length).toBe(1);
  });
  it('redacts an additional confirmation in the complete second pass', () => {
    const events = [];
    const registry = streamIdentity(
      { secretlint: false, debug: (event) => events.push(event) },
      100,
      false,
      true
    );
    registry.prepare('Oregon', []);
    const finding = {
      start: 0,
      end: 6,
      type: 'STATE',
      category: 'personal',
      rule: 'fixture',
      confidence: 0.95,
    };
    assert.doesNotThrow(() => registry.prepare('Oregon', [finding]));
    expect(sanitize('Oregon', registry.options).text).toBe('[REDACTED]');
    expect(
      events.some(
        (event) =>
          event.event === 'two-pass-confirmation' && event.type === 'STATE'
      )
    ).toBe(true);
    expect(JSON.stringify(events).includes('Oregon')).toBe(false);
  });
  it('preserves Rust paths while still detecting actual IPv6 addresses', () => {
    const code = 'codec:: serde_json:: a::b a:: :: <T>:: a::coding_';
    expect(sanitize(code, { profile: 'publication' }).text).toBe(code);
    for (const value of [
      '::1',
      'fe80::1234',
      'fd12:3456:789a:1::7',
      'a::b:1234',
    ]) {
      expect(
        inspect(value, { profile: 'publication' }).some(
          (f) => f.rule === 'ipv6'
        )
      ).toBe(true);
    }
  });
  it('respects public policy in escaped text and still removes private namesakes', async () => {
    const input = jsonl([{ toolUseResult: { stdout: '"Elon Musk' } }]);
    for (const options of [
      { publicKnowledge: false },
      { knownPersonal: [{ type: 'PERSON', value: 'Elon Musk' }] },
    ]) {
      const configuration = { ...publication, ...options };
      expect(sanitize(input, configuration).text.includes('Elon Musk')).toBe(
        false
      );
      expect(
        (await createSanitizer(configuration).sanitize(input)).text.includes(
          'Elon Musk'
        )
      ).toBe(false);
    }
  });
  it('redacts nonempty escaped authorization and cookie headers without losing surrounding text', async () => {
    for (const value of [
      'curl -H "Cookie: sid=fixture; other=value" done',
      'curl -H "Authorization: Bearer fixture-private" done',
    ]) {
      const input = jsonl([{ text: value }]);
      for (const result of [
        sanitize(input, publication),
        await createSanitizer(publication).sanitize(input),
      ]) {
        expect(JSON.parse(result.text).text.endsWith('" done')).toBe(true);
        expect(result.text.includes('fixture')).toBe(false);
      }
    }
  });
});
