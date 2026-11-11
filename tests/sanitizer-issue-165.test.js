import { describe, it, expect } from 'test-anywhere';
import {
  createSanitizer,
  createSyncSanitizer,
  inspect,
  sanitize,
} from '../src/index.js';
import { collectMatches, scanMatches } from '../src/detection.js';

const policy = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  transformation: { mode: 'placeholder', map: false, existing: 'keep' },
};
function record(fields) {
  const value = { level: 'INFO', time: 1730000000000, msg: 'metric' };
  for (let i = 0; i < fields; i++) {
    value[`field${i}`] =
      i % 3 === 0 ? `value_${i}_ok` : i % 3 === 1 ? i * 7 : true;
  }
  return `${JSON.stringify(value)}\n`;
}
function views(text, options) {
  const events = [];
  const result = sanitize(text, {
    ...options,
    debug: (event) => {
      if (event.event === 'structured-value') {
        events.push(event);
      }
    },
  });
  return {
    result,
    total: events.length,
    inspected: events.filter((event) => !event.cached).length,
  };
}

describe('issue 165: one inspection per structured view and call', () => {
  it('inspects each key and string value a single time per sanitize call', () => {
    const { result, total, inspected } = views(record(32), {
      ...policy,
      structured: 'json',
    });
    // 35 keys and 13 string values; verification passes reuse them.
    expect(inspected).toBe(48);
    expect(total).toBe(144);
    expect(result.text).toBe(record(32));
  });

  it('shares a repeated view within one record', () => {
    const text = `${JSON.stringify({ a: 'INFO', b: 'INFO', c: 'INFO' })}\n`;
    const { inspected } = views(text, { ...policy, structured: 'json' });
    // Keys a, b, c and one inspection of "INFO".
    expect(inspected).toBe(4);
  });

  it('does not reuse results across calls', () => {
    const options = { ...policy, structured: 'json' };
    expect(views(record(2), options).inspected).toBe(8);
    expect(views(record(2), options).inspected).toBe(8);
  });

  it('keeps sanitize output and findings equal to plain inspection', () => {
    const text = `${JSON.stringify({
      note: 'Иван Петров живёт в Москве, телефон +7 916 123-45-67',
      author: 'Иван Петров',
      copy: 'Иван Петров',
      token: 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8',
    })}\n`;
    const options = { ...policy, structured: 'json' };
    const sync = createSyncSanitizer(options).sanitize(text);
    const spans = (findings) =>
      findings.map((f) => `${f.start}:${f.end}:${f.type}`).sort();
    expect(spans(sync.findings)).toEqual(spans(inspect(text, options)));
    expect(sync.text.includes('Иван')).toBe(false);
    expect(sync.text.includes('ghp_')).toBe(false);
    // Later passes see the allocated placeholders, not a stale result.
    expect(sync.text).toBe(sanitize(text, options).text);
  });

  it('analyzes each view a single time in the asynchronous engine', async () => {
    const seen = new Map();
    const engine = createSanitizer({
      ...policy,
      structured: 'json',
      secretlint: false,
      detectors: [
        {
          id: 'counter',
          detect: async (text) => {
            seen.set(text, (seen.get(text) ?? 0) + 1);
            return [];
          },
        },
      ],
    });
    const text = `${JSON.stringify({ a: 'INFO', b: 'INFO' })}\n`;
    const result = await engine.sanitize(text);
    expect(result.text).toBe(text);
    expect(seen.get('INFO')).toBe(1);
    expect(seen.get('a')).toBe(1);
  });
});

describe('issue 165: scanning without cloning expressions', () => {
  const cases = [
    [/a|(?:)/gu, 'xa😀a'],
    [/(?:)/gu, '😀x'],
    [/(?:)/g, '😀x'],
    [/b+/g, 'abbcbd'],
    [/(\d)(\w)?/gu, '1a 2 3c'],
    [/x/y, 'xxax'],
    [/x/gy, 'xxax'],
  ];
  for (const [regex, text] of cases) {
    it(`matches like matchAll for ${regex} on ${JSON.stringify(text)}`, () => {
      const native = [
        ...text.matchAll(
          regex.global ? regex : new RegExp(regex.source, `${regex.flags}g`)
        ),
      ].map((match) => [match.index, ...match]);
      const scanned = [...scanMatches(text, regex)].map((match) => [
        match.index,
        ...match,
      ]);
      expect(scanned).toEqual(native);
    });
  }

  it('starts at zero and restores lastIndex', () => {
    const regex = /b/g;
    regex.lastIndex = 3;
    expect([...scanMatches('bab', regex)].map((m) => m.index)).toEqual([0, 2]);
    expect(regex.lastIndex).toBe(3);
    const found = [];
    collectMatches('bab', regex, (f) => found.push(f.start), {});
    expect(found).toEqual([0, 2]);
    expect(regex.lastIndex).toBe(3);
  });

  it('lets a callback reuse the same expression', () => {
    const regex = /b/g;
    const found = [];
    collectMatches(
      'bab',
      regex,
      (f) => found.push(f.start),
      {},
      0,
      () => {
        collectMatches('bbbb', regex, () => {}, {});
        return true;
      }
    );
    expect(found).toEqual([0, 2]);
    const outer = [];
    for (const match of scanMatches('bab', regex)) {
      outer.push(match.index);
      expect([...scanMatches('bbbb', regex)].length).toBe(4);
    }
    expect(outer).toEqual([0, 2]);
  });
});
