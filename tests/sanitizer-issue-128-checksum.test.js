import { describe, it, expect } from 'test-anywhere';
import { Readable } from 'node:stream';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect, sanitize } from '../src/index.js';
import { runCli } from '../bin/sensitive-data-sanitizer.js';
import {
  base62,
  crc32,
  tokenChecksum,
  tokenWithChecksum,
} from '../src/token-checksum.js';

// Kingfisher and osv-scalibr validate the CRC32 suffix of GitHub and npm
// tokens offline. The tests generate their tokens at runtime.
const body = 'aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW1';
const flip = (token) =>
  `${token.slice(0, -1)}${token.at(-1) === 'A' ? 'B' : 'A'}`;

describe('offline token checksums', () => {
  it('computes IEEE CRC32 and fixed-width base62', () => {
    expect(crc32('123456789')).toBe(0xcbf43926);
    expect(crc32('')).toBe(0);
    expect(base62(0)).toBe('000000');
    expect(base62(61)).toBe('00000z');
    expect(base62(62)).toBe('000010');
  });

  it('classifies valid, invalid and unrelated values', () => {
    for (const prefix of ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'npm_']) {
      const token = tokenWithChecksum(prefix, body);
      expect(token.length).toBe(prefix.length + 36);
      expect(tokenChecksum(token)).toBe(true);
      expect(tokenChecksum(flip(token))).toBe(false);
    }
    expect(tokenChecksum(`ghx_${body}000000`)).toBe(undefined);
    expect(tokenChecksum('plain words')).toBe(undefined);
  });

  it('raises confidence for valid tokens and still redacts invalid ones', async () => {
    for (const prefix of ['ghp_', 'npm_']) {
      const valid = tokenWithChecksum(prefix, body);
      const strong = await inspect(`token=${valid}`);
      const weak = await inspect(`token=${flip(valid)}`);
      const service = prefix === 'ghp_' ? 'github' : 'npm';
      const rule = prefix === 'ghp_' ? 'github-pat' : 'npm-access-token';
      const score = (findings, id) =>
        findings.find((f) => f.rule === id).confidence;
      expect(score(strong, service)).toBe(0.99);
      expect(score(strong, `gitleaks/${rule}`)).toBe(0.99);
      expect(score(weak, service)).toBe(0.95);
      expect(score(weak, `gitleaks/${rule}`) < 0.99).toBe(true);
      expect((await sanitize(`token=${flip(valid)}`)).text).toBe(
        'token=[REDACTED]'
      );
    }
  });
});

describe('scan with several paths', () => {
  const io = (sink) => ({
    stdin: Readable.from([]),
    stdout: { write: (value) => sink.push(String(value)) },
    stderr: { write: () => {} },
  });

  it('reports every listed file, as a pre-commit hook passes them', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sds-paths-'));
    try {
      await writeFile(join(dir, 'a.txt'), 'mail bob@private.test\n');
      await writeFile(join(dir, 'b.txt'), 'nothing here\n');
      await writeFile(join(dir, 'c.txt'), 'mail eve@private.test\n');
      const out = [];
      const code = await runCli(
        ['scan', join(dir, 'a.txt'), join(dir, 'b.txt'), '--native-only'],
        io(out)
      );
      expect(code).toBe(1);
      const report = JSON.parse(out.join(''));
      expect(report.results.length).toBe(2);
      expect(report.results.map((r) => r.findings.length)).toEqual([1, 0]);
      const clean = [];
      expect(
        await runCli(['scan', join(dir, 'b.txt'), '--native-only'], io(clean))
      ).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps single-path commands strict', async () => {
    for (const argv of [
      ['redact', 'a.txt', 'b.txt'],
      ['scan', '-', 'a.txt'],
    ]) {
      const err = [];
      const sink = io([]);
      sink.stderr = { write: (value) => err.push(String(value)) };
      expect(await runCli(argv, sink)).toBe(2);
    }
  });
});
