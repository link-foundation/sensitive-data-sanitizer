import { it, expect } from 'test-anywhere';
import { sanitize } from '../src/index.js';
import { jsonStringLiterals } from '../src/json-string-runs.js';

it('scans escaped JSON literals once, preserving offsets after quotes and slashes', () => {
  const values = ['a\\"b', 'c\\\\d', '', 'Person-1', 'tail'];
  const text = JSON.stringify(values);
  expect(
    [...jsonStringLiterals(text)].map((literal) => JSON.parse(literal))
  ).toEqual(values);
});
it('handles finite unfinished escaped-quote runs without restarting at inner quotes', () => {
  const text = `"${'\\"'.repeat(32768)}`;
  expect([...jsonStringLiterals(text)]).toEqual([]);
});
it('rejects escaped placeholder collisions in literals longer than the decoding window', () => {
  const text = JSON.stringify({
    name: 'Jane Doe',
    quote: `${'x'.repeat(16384)} Person-1`,
  }).replace('Person-1', 'Person\\u002d1');
  expect(() =>
    sanitize(text, {
      structured: 'json',
      transformation: { mode: 'placeholder' },
    })
  ).toThrow();
});
it('supports custom detector types and refuses ambiguous generated type labels', () => {
  const result = sanitize('canary', {
    knownPersonal: [{ type: 'CUSTOM__VALUE', value: 'canary' }],
    transformation: { mode: 'placeholder' },
  });
  expect(result.text).toBe('CustomValue-1');
  expect(() =>
    sanitize('first second', {
      knownPersonal: [
        { type: 'CUSTOM_VALUE', value: 'first' },
        { type: 'CUSTOM__VALUE', value: 'second' },
      ],
      transformation: { mode: 'placeholder' },
    })
  ).toThrow();
});
