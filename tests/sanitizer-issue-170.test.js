import { performance } from 'node:perf_hooks';
import { describe, it, expect } from 'test-anywhere';
import { detectContext } from '../src/context.js';
import { detectPersonalEvidence } from '../src/personal-evidence.js';
import { decodedRuns } from '../src/encoded.js';
import { createSyncSanitizer } from '../src/credentials-entry.js';

// Issue 170: one long single-line letter run (a base64 blob) made the
// credential key scans overflow V8's regular-expression backtracking stack,
// so Node failed closed with ERR_SANITIZATION. The separated-key scan was
// also quadratic on `a-a-a-…` runs: 256 KiB took about 100 seconds.
// Before the fix the context scans overflowed from 6 MiB (`A`) and 8 MiB (`A_`)
// once a later line held a candidate such as `password=`; 12 MiB keeps a margin
// while staying cheap on every runtime.
const large = 12 * 1024 * 1024;
const secret = 'xx-private-value';
const tail = `\npassword=${secret}\n`;
const run = (unit, bytes) => unit.repeat(Math.ceil(bytes / unit.length));
const detect = (text) => {
  const found = [];
  detectContext(text, (finding) => found.push(finding), true);
  return found;
};
// The plain and camelCase scans may both report `accessToken: …`.
const values = (text) => [
  ...new Set(
    detect(text).map((finding) => text.slice(finding.start, finding.end))
  ),
];

describe('issue 170: long letter runs', () => {
  it('scans 12 MiB capital and separated runs without overflowing', () => {
    for (const unit of ['A', 'A_']) {
      const text = run(unit, large) + tail;
      expect(values(text)).toEqual([secret]);
    }
  });

  it('keeps the separated-key scan linear on `a-` and `a.` runs', () => {
    for (const unit of ['a-', 'a.', 'ab-']) {
      const text = run(unit, 256 * 1024) + tail;
      const started = performance.now();
      expect(values(text)).toEqual([secret]);
      expect(performance.now() - started).toBeLessThan(5000);
    }
  });

  it('sanitizes the issue reproduction through the public API', () => {
    const engine = createSyncSanitizer({
      credentialsOnly: true,
      maxInputLength: 64 * 1024 * 1024,
    });
    // 8 MiB failed with ERR_SANITIZATION from 0.20.0 to 0.22.2.
    const result = engine.sanitize(run('A', 8 * 1024 * 1024) + tail);
    expect(result.redactions).toBe(1);
    expect(result.text.includes(secret)).toBe(false);
  });

  it('still finds camelCase keys of any shape and length', () => {
    for (const unit of ['Ab', 'aB', 'A1']) {
      expect(values(run(unit, 1024 * 1024) + tail)).toEqual([secret]);
    }
    const glued = `${run('Ab', 1024 * 1024)}ClientSecret: ${secret}\n`;
    expect(values(glued)).toEqual([secret]);
    for (const text of [
      `veryLongServiceAccountClientSecret: "${secret}"`,
      `ÉtatApiKey = "${secret}"`,
      `dbPassword: ${secret}`,
      `accessToken: ${secret}`,
    ]) {
      expect(values(text)).toEqual([secret]);
    }
    for (const text of ['tokenType: bearer', 'maxTokens: 1234']) {
      expect(values(text)).toEqual([]);
    }
  });

  it('still finds separated keys with up to 16 words on each side', () => {
    const words = (count) =>
      Array.from({ length: count }, (_, i) => `w${i}`).join('_');
    for (const text of [
      `spring.datasource.password=${secret}`,
      `this._config.password = "${secret}"`,
      `${words(16)}_PASSWORD=${secret}`,
      `PASSWORD_${words(16)}=${secret}`,
      `${words(20).replaceAll('_', '.')}.password=${secret}`,
    ]) {
      expect(values(text)).toEqual([secret]);
    }
  });

  it('scans a 12 MiB dotted run for obfuscated e-mail without overflowing', () => {
    const emails = (text) => {
      const found = [];
      detectPersonalEvidence(text, (finding) => found.push(finding));
      return found
        .filter((finding) => finding.type === 'EMAIL')
        .map((finding) => text.slice(finding.start, finding.end));
    };
    const email = 'jane.roe (at) example (dot) org';
    expect(emails(`${run('a.', large)}\nmail ${email}\n`)).toEqual([email]);
    expect(emails(`write to a.b.c.d.e.f.g.h [at] mail.example.co.uk`)).toEqual([
      'a.b.c.d.e.f.g.h [at] mail.example.co.uk',
    ]);
  });

  it('scans 12 MiB percent-encoded and wrapped runs without overflowing', () => {
    // Before the fix both scans overflowed from 8 MiB.
    const percent = run('%41', large);
    const wrapped = `QUJDREVGR0hJSktMTU5P${run('\nQUJD', large)}`;
    for (const text of [percent, wrapped]) {
      const runs = [...decodedRuns(text)];
      expect(
        runs.map(({ start, end, limited }) => ({ start, end, limited }))
      ).toEqual([{ start: 0, end: text.length, limited: true }]);
    }
  });

  it('masks a 12 MiB percent-encoded run through the public API', () => {
    const engine = createSyncSanitizer({
      credentialsOnly: true,
      maxInputLength: 64 * 1024 * 1024,
    });
    const result = engine.sanitize(run('Ab%', large) + tail);
    expect(result.text.includes(secret)).toBe(false);
    expect(result.text.includes('Ab%Ab%')).toBe(false);
  });
});
