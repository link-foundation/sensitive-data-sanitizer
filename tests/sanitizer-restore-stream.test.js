import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'test-anywhere';
import {
  createRestoreMap,
  createStreamingRestorer,
  sanitize,
} from '../src/index.js';

const original = 'Zoë "Example"\\Path\n🧪';
const token = '[[WORK:PERSON_1]]';

function fixture() {
  const map = createRestoreMap({ format: '[[WORK:{TYPE}_{n}]]' });
  map.entries.push(
    { type: 'PERSON', number: 1, token, values: [original], aliases: [] },
    {
      type: 'CREDENTIAL',
      number: 1,
      token: '[[WORK:CREDENTIAL_1]]',
      values: ['synthetic-value'],
      aliases: [],
    },
    {
      type: 'LOCATION',
      number: 1,
      token: '[[WORK:LOCATION_1]]',
      values: [token],
      aliases: [],
    }
  );
  return map;
}

function collect(cursor, chunks) {
  return chunks.map((chunk) => cursor.write(chunk)).join('') + cursor.finish();
}

describe('bounded reply restoration', () => {
  it('is invariant across every single UTF-8 byte cut and byte-at-a-time input', () => {
    const restorer = createStreamingRestorer(fixture());
    const text = `🧪 ${token}! 𐐀${token} ${token}𐐀 ${token}́ [[OTHER:PERSON_1]] [[WORK:PERSON_11]] [[WORK:CREDENTIAL_1]] [[WORK:LOCATION_1]] [[WORK:PERSON_`;
    const expected = text
      .replace(token, original)
      .replace('[[WORK:LOCATION_1]]', token);
    const bytes = Buffer.from(text);
    for (let cut = 0; cut <= bytes.length; cut += 1) {
      expect(
        collect(restorer.open({ encoding: 'utf8' }), [
          bytes.subarray(0, cut),
          bytes.subarray(cut),
        ])
      ).toBe(expected);
    }
    expect(
      collect(
        restorer.open({ encoding: 'utf8' }),
        Array.from(bytes, (byte) => Uint8Array.of(byte))
      )
    ).toBe(expected);
    expect(collect(restorer.open(), text.split(''))).toBe(expected);
  });

  it('takes a snapshot and emits canonical text without consulting document occurrences', () => {
    const result = sanitize('Alice Fiction', {
      knownOnly: true,
      knownPersonal: [{ type: 'PERSON', value: 'Alice Fiction' }],
      transformation: { mode: 'placeholder' },
    });
    const restorer = createStreamingRestorer(result.map);
    result.map.entries[0].values[0] = 'changed';
    result.map.documents[0].occurrences[0].raw = 'changed';
    const cursor = restorer.open();
    expect(cursor.write('Hi Person-')).toBe('Hi ');
    expect(cursor.write('1')).toBe('');
    expect(cursor.finish()).toBe('Alice Fiction');
  });

  it('isolates sessions even when their token spellings match', () => {
    const other = fixture();
    other.entries[0].values[0] = 'Another Synthetic Person';
    const left = createStreamingRestorer(fixture()).open();
    const right = createStreamingRestorer(other).open();
    expect(left.write(token.slice(0, 6))).toBe('');
    expect(right.write(`${token}!`)).toBe('Another Synthetic Person!');
    expect(left.write(`${token.slice(6)}!`)).toBe(`${original}!`);
    expect(right.finish()).toBe('');
    expect(left.finish()).toBe('');
  });

  it('enforces input, map and expansion limits and rejects invalid or truncated UTF-8', () => {
    expect(() =>
      createStreamingRestorer(fixture(), { maxEntries: 1 })
    ).toThrow();
    expect(() =>
      createStreamingRestorer(fixture(), { maxMapUnits: 10 })
    ).toThrow();
    const restorer = createStreamingRestorer(fixture(), {
      maxChunkUnits: 64,
      maxInputUnits: 64,
      maxOutputUnits: original.length,
    });
    const expansion = restorer.open();
    expect(expansion.write(token)).toBe('');
    expect(() => expansion.write('!')).toThrow();
    expect(() => expansion.finish()).toThrow();
    const input = restorer.open();
    expect(input.write(token.slice(0, 5))).toBe('');
    expect(() => input.write(' '.repeat(60))).toThrow();
    expect(() => restorer.open().write(' '.repeat(65))).toThrow();
    expect(() =>
      restorer.open({ encoding: 'utf8' }).write(Uint8Array.of(255))
    ).toThrow();
    const truncated = restorer.open({ encoding: 'utf8' });
    expect(truncated.write(Uint8Array.of(0xf0))).toBe('');
    expect(() => truncated.finish()).toThrow();
  });

  it('discards a pending token on cancellation', () => {
    const controller = new AbortController();
    const restorer = createStreamingRestorer(fixture());
    const cursor = restorer.open({ signal: controller.signal });
    expect(cursor.write(token)).toBe('');
    controller.abort(new Error(original));
    expect(() => cursor.finish()).toThrow('output was blocked');
    const cancelled = restorer.open();
    expect(cancelled.write(token)).toBe('');
    cancelled.cancel();
    expect(() => cancelled.finish()).toThrow();
  });
});
