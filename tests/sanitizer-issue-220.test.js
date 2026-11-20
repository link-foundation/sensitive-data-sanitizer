import { describe, expect, it } from 'test-anywhere';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { fileURLToPath, URL } from 'node:url';
import { runCli } from '../bin/sensitive-data-sanitizer.js';
import { decodeLinoObject } from '../src/lino-object.js';

const cli = fileURLToPath(
  new URL('../bin/sensitive-data-sanitizer.js', import.meta.url)
);

async function workspace(callback) {
  const root = mkdtempSync(join(tmpdir(), 'sds-scan-'));
  try {
    return await callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function run(args, input) {
  let stdout = '';
  let stderr = '';
  const status = await runCli(args, {
    stdin: Readable.from(input === undefined ? [] : [input]),
    stdout: {
      write: (value) => {
        stdout += value;
      },
    },
    stderr: {
      write: (value) => {
        stderr += value;
      },
    },
  });
  return { status, stdout, stderr };
}

function invoke(root, args, env = {}) {
  const [command, ...options] = globalThis.Deno
    ? [process.execPath, 'run', '-A']
    : [process.execPath];
  return spawnSync(command, [...options, cli, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

describe('CLI languages and Links Notation', () => {
  it('provides localized help and diagnostics in the four requested languages', async () => {
    for (const [locale, help, error] of [
      ['en', 'Usage', 'Sanitization failed'],
      ['ru', 'Использование', 'обработать'],
      ['zh-CN', '用法', '失败'],
      ['hi', 'उपयोग', 'विफल'],
    ]) {
      const result = await run(['--locale', locale, '--help']);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(help);
      const invalid = await run(['scan', '--invalid', '--locale', locale]);
      expect(invalid.status).toBe(2);
      expect(invalid.stderr.toLowerCase()).toContain(error.toLowerCase());
      expect(invalid.stderr).toContain('ERR_ARGUMENT');
    }
  });

  it('reads a Links Notation policy and emits metadata in the default and compatibility formats', async () => {
    await workspace(async (root) => {
      const policy = join(root, 'policy.lino');
      writeFileSync(
        policy,
        '(o: (secretlint false) (knownSecrets (a: "internal reference value")))\n'
      );
      const args = ['scan', '-', '--config', policy];
      const input = 'project internal reference value';
      const native = await run(args, input);
      expect(native.status).toBe(1);
      expect(native.stdout.startsWith('(')).toBe(true);
      expect(
        decodeLinoObject(native.stdout, 8192).results[0].findings.length
      ).toBe(1);

      for (const [format, check] of [
        ['json', '"complete": true'],
        ['sarif', '"version": "2.1.0"'],
        ['csv', '"finding"'],
        ['junit', 'failures="1"'],
      ]) {
        const result = await run([...args, '--format', format], input);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain(check);
        expect(result.stdout).not.toContain('internal reference value');
      }
      const report = join(root, 'scan.lino');
      expect(
        (await run([...args, '--report-path', report], input)).stdout
      ).toBe('');
      expect(readFileSync(report, 'utf8')).toBe(native.stdout);
      expect(
        (await run([...args, '--report-path', report], input)).status
      ).toBe(2);
    });
  });

  it('honors an explicit environment policy and locale and lets flags override them', async () => {
    await workspace((root) => {
      const policy = join(root, 'old-policy.json');
      writeFileSync(policy, '{"knownSecrets":["internal reference value"]}');
      writeFileSync(join(root, 'sample.txt'), 'internal reference value');
      const env = { SDS_CONFIG: policy, SDS_LOCALE: 'ru' };
      expect(
        invoke(root, ['scan', 'sample.txt', '--native-only'], env).status
      ).toBe(1);
      expect(invoke(root, ['--help'], env).stdout).toContain('Использование');
      expect(invoke(root, ['--locale', 'en', '--help'], env).stdout).toContain(
        'Usage'
      );
      const explicit = join(root, 'explicit.lino');
      writeFileSync(explicit, '(o: (knownOnly true))\n');
      expect(
        invoke(
          root,
          ['scan', 'sample.txt', '--native-only', '--config', explicit],
          env
        ).status
      ).toBe(0);
    });
  });
});

describe('CLI scan input and suppression', () => {
  it('scans index blobs and respects Git ignore rules for worktree scans', async () => {
    await workspace((root) => {
      function git(...args) {
        const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
        expect(result.status).toBe(0);
      }
      git('init', '-q');
      git('config', 'core.autocrlf', 'false');
      writeFileSync(join(root, '.gitignore'), 'build.log\n');
      writeFileSync(join(root, 'build.log'), 'password=fixture-ignored');
      const tracked = '--tracked.log';
      writeFileSync(join(root, tracked), 'password=fixture-staged');
      git('add', '--', '.gitignore', tracked);
      writeFileSync(join(root, tracked), 'public content');
      const args = ['scan', '--native-only', '--format', 'json'];
      const staged = invoke(root, [...args, '--staged', '--', tracked]);
      expect(staged.status).toBe(1);
      expect(JSON.parse(staged.stdout).results[0].path).toBe(tracked);
      expect(staged.stdout).not.toContain('fixture-staged');
      expect(invoke(root, [...args, '--', tracked]).status).toBe(0);
      expect(invoke(root, [...args, 'build.log']).status).toBe(1);
      const visible = invoke(root, [...args, '--respect-gitignore']);
      expect(visible.status).toBe(0);
      expect(
        JSON.parse(visible.stdout).results.map((item) => item.path)
      ).toEqual(['--tracked.log', '.gitignore'].sort());
    });
  });

  it('suppresses only the recorded count of exact values on the same path', async () => {
    await workspace((root) => {
      const env = { SDS_BASELINE_KEY: 'ba'.repeat(32) };
      const file = join(root, 'fixture.txt');
      const baseline = join(root, 'baseline.lino');
      writeFileSync(file, 'password=fixture-old\n');
      const args = ['scan', '--native-only', '--format', 'json'];
      const recorded = invoke(
        root,
        [...args, './fixture.txt', '--write-baseline', baseline],
        env
      );
      expect(recorded.status).toBe(1);
      const originalCount = JSON.parse(recorded.stdout).results[0].findings
        .length;
      const encoded = readFileSync(baseline, 'utf8');
      expect(encoded).not.toContain('fixture-old');
      expect(encoded).not.toContain('fixture.txt');

      writeFileSync(file, 'ordinary header\npassword=fixture-old\n');
      const alias = join(root, 'alias');
      symlinkSync(root, alias, 'junction');
      const moved = invoke(
        root,
        [...args, join(alias, 'fixture.txt'), '--baseline', baseline],
        env
      );
      expect(moved.status).toBe(0);
      expect(JSON.parse(moved.stdout).baselined).toBe(originalCount);

      writeFileSync(
        file,
        'password=fixture-old\npassword=fixture-new\npassword=fixture-old\n'
      );
      const added = invoke(root, [...args, file, '--baseline', baseline], env);
      expect(added.status).toBe(1);
      const report = JSON.parse(added.stdout);
      expect(report.baselined).toBe(originalCount);
      expect([
        ...new Set(report.results[0].findings.map(({ line }) => line)),
      ]).toEqual([2, 3]);
      expect(
        invoke(root, [...args, file, '--baseline', baseline], {
          SDS_BASELINE_KEY: '',
        }).status
      ).toBe(2);
    });
  });

  it('scans compressed text and reports depth and inflation failures as incomplete', async () => {
    const source = Buffer.from('密码：fixture-archive\n');
    const options = [
      'scan',
      '-',
      '--native-only',
      '--max-archive-depth',
      '1',
      '--format',
      'json',
    ];
    const compressed = gzipSync(source);
    const result = await run(options, compressed);
    expect(result.status).toBe(1);
    expect(
      JSON.parse(result.stdout).results[0].findings.length
    ).toBeGreaterThan(0);
    expect(result.stdout).not.toContain('fixture-archive');

    const nested = await run(options, gzipSync(compressed));
    expect(nested.status).toBe(2);
    expect(JSON.parse(nested.stdout).skipped[0].reason).toBe(
      'ERR_ARCHIVE_DEPTH'
    );
    const large = await run(
      [...options, '--max-bytes', '100'],
      gzipSync('x'.repeat(512))
    );
    expect(large.status).toBe(2);
    expect(JSON.parse(large.stdout).skipped[0].reason).toBe('ERR_LIMIT');
  });

  it('scans a ZIP containing a TAR and reports the archive member path', async () => {
    // Deflated ZIP containing one ustar member with a synthetic Hindi password.
    const fixture = Buffer.from(
      'UEsDBBQAAAAIAAAAIQBVVH55iQAAAAAoAAALAAAAZml4dHVyZS50YXLtzjEKwkAQheHUniIXUCayGPA2i6wYsNpsJJfwEMLYWNkErDzLHMXVRkkftfi/5g3TvBfDPvg2LFKfiqlItnLuldk4RVz9vp//SqplXZQy2aIPXZt8zPXf6PpDphfTu+nNdDC92vloelqX26ZPXQxzHze75hBmv54JAAAAAAAAAAAAAAAAABh5AFBLAQIUAxQAAAAIAAAAIQBVVH55iQAAAAAoAAALAAAAAAAAAAAAAACAAQAAAABmaXh0dXJlLnRhclBLBQYAAAAAAQABADkAAACyAAAAAAA=',
      'base64'
    );
    const args = [
      'scan',
      '-',
      '--native-only',
      '--max-archive-depth',
      '2',
      '--format',
      'json',
    ];
    const scanned = await run(args, fixture);
    expect(scanned.status).toBe(1);
    expect(JSON.parse(scanned.stdout).results[0].path).toBe(
      '-!fixture.tar!release.txt'
    );
    expect(scanned.stdout).not.toContain('fixture-archive');
    const truncated = await run(args, fixture.subarray(0, 50));
    expect(truncated.status).toBe(2);
    expect(JSON.parse(truncated.stdout).skipped[0].reason).toBe('ERR_ARCHIVE');
  });
});
