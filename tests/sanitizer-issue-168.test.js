import { performance } from 'node:perf_hooks';
import { describe, it, expect } from 'test-anywhere';
import { createSyncSanitizer } from '../src/credentials-entry.js';
import { projectText } from '../src/projection.js';
import { refineCredentialSpans } from '../src/credential-spans.js';

// Issue 168: re-sanitizing a log that already holds `hive-mask` output cost
// about 100 µs per mask. The ellipsis changed the NFKC detection view, which
// doubled every scan, and the residual check inspected the clean output again.
const engine = (debug) =>
  createSyncSanitizer({
    credentialsOnly: true,
    preserveEncoding: true,
    transformation: { mode: 'hive-mask' },
    ...(debug ? { debug } : {}),
  });
const masked = [
  (i) => `line ${i} token ghp…b4N ok`,
  (i) => `line ${i} Authorization: Bearer 012…567`,
  (i) => `line ${i} key sk-…xyz and ghp…b4N`,
];
const view = (input) => {
  const result = projectText(input);
  return {
    text: result.text,
    changed: result.changed,
    spans: result.starts
      ? Array.from(result.text, (_c, i) => [result.starts[i], result.ends[i]])
      : null,
  };
};

describe('issue 168: already-masked credentials', () => {
  it('keeps a view with mask ellipses unchanged', () => {
    for (const input of ['token ghp…b4N', 'Bearer 012…567', '…', 'a … b']) {
      expect(projectText(input)).toEqual({ text: input, changed: false });
    }
  });

  it('still normalizes and maps the other units around plain runs', () => {
    expect(view(`cafe${String.fromCodePoint(0x301)} x`)).toEqual({
      text: 'café x',
      changed: true,
      spans: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 5],
        [5, 6],
        [6, 7],
      ],
    });
    expect(view('a１٢b').text).toBe('a12b');
    expect(view('a１٢b').spans).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ]);
    expect(view('x<b>y</b>\x1b[31mz\0').text).toBe('xyz');
    expect(view('x<b>y</b>\x1b[31mz\0').spans).toEqual([
      [0, 1],
      [4, 5],
      [14, 15],
    ]);
    expect(view('k \\u0041\\u0042 …').text).toBe('k AB …');
    expect(view('U+0061 U+0062 U+0063 U+0064 q').text).toBe('abcd q');
    expect(view('U+0061 U+0062 U+0063 U+0064 q').spans[0]).toEqual([0, 27]);
    // A combining mark after the ellipsis joins it into one normalized unit.
    const acute = String.fromCodePoint(0x301);
    const softHyphen = String.fromCodePoint(0xad);
    expect(view(`…${acute} ${softHyphen}`).text).toBe(
      `…${acute} `.normalize('NFKC')
    );
  });

  it('leaves masked lines unchanged and inspects them once', () => {
    const text = masked.map((make, i) => make(i)).join('\n');
    const events = [];
    const result = engine((event) => events.push(event)).sanitize(text);
    expect(result.text).toBe(text);
    expect(result.redactions).toBe(0);
    expect(events.filter((e) => e.event === 'detected')).toEqual([
      { event: 'detected', count: 0 },
    ]);
  });

  it('keeps verifying output that had findings', () => {
    const token = `ghp_${'a1B2'.repeat(9)}`;
    const events = [];
    const result = engine((event) => events.push(event)).sanitize(
      `token ${token} ok`
    );
    expect(result.text).toBe('token ghp…1B2 ok');
    expect(
      events.filter((e) => e.event === 'detected').length
    ).toBeGreaterThanOrEqual(2);
    expect(engine().sanitize(result.text).text).toBe(result.text);
  });

  it('scales with the number of masks', () => {
    const lines = (count) =>
      Array.from({ length: count }, (_, i) => masked[i % 3](i)).join('\n');
    const sanitizer = engine();
    sanitizer.sanitize(lines(300));
    const time = (count) => {
      const text = lines(count);
      const start = performance.now();
      expect(sanitizer.sanitize(text).text).toBe(text);
      return performance.now() - start;
    };
    // 3000 lines held 4000 masks and took seconds in 0.22.1.
    expect(time(3000)).toBeLessThan(2500);
  });

  it('bounds open-ended credential spans without comparing every pair', () => {
    const unit = 'key: abcdef. ';
    const count = 25000;
    const text = unit.repeat(count);
    const findings = [];
    for (let i = 0; i < count; i++) {
      const start = i * unit.length + 5;
      const base = { type: 'SECRET', category: 'credential', confidence: 0.9 };
      findings.push(
        { ...base, start, end: start + 8, rule: 'context' },
        { ...base, start, end: start + 6, rule: 'github' }
      );
    }
    const begin = performance.now();
    const refined = refineCredentialSpans(text, findings);
    expect(performance.now() - begin).toBeLessThan(2500);
    expect(refined.length).toBe(findings.length);
    expect(refined[0]).toEqual({ ...findings[0], end: 11 });
    expect(refined.at(-2).end).toBe(refined.at(-1).end);
    // A bounding finding that starts elsewhere does not shorten the value.
    const [other] = refineCredentialSpans(text, [
      findings[0],
      { ...findings[1], start: 6 },
    ]);
    expect(other.end).toBe(13);
  });
});
