import { describe, it, expect } from 'test-anywhere';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runCli } from '../bin/sensitive-data-sanitizer.js';
import { auditGitHistory, createSanitizer } from '../src/index.js';

const cli = resolve('bin/sensitive-data-sanitizer.js');
function invoke(args, input = '') {
  return spawnSync(process.execPath, [cli, ...args], {
    input,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
}
function workspace(callback) {
  const root = mkdtempSync(join(tmpdir(), 'sanitizer-'));
  try {
    return callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('sanitizer CLI optional PII engine', () => {
  it('runs a required local PII bridge for unlabelled names', () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    const result = invoke(
      [
        'redact',
        '-',
        '--presidio',
        resolve('experiments/mock-scanner.mjs'),
        '--python',
        process.execPath,
      ],
      '😀 Zoë arrived.'
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('😀 [REDACTED] arrived.');
    expect(result.stderr).toBe('');
  });
  it('rejects model or Python options without a selected PII bridge', () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    for (const option of ['--python', '--model', '--language']) {
      const result = invoke(['redact', '-', option, 'unused'], 'ordinary text');
      expect(result.status).toBe(2);
      expect(result.stdout).toBe('');
    }
  });
});

describe('sanitizer CLI publication', () => {
  it('redacts complete stdin including a multiline truncated key', () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    const result = invoke(
      ['redact', '-'],
      'before\n-----BEGIN PRIVATE KEY-----\nconfidential'
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('before\n[REDACTED]');
    expect(result.stderr).toBe('');
  });
  it('reports findings through exit 1 and metadata without leaking source', () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    const result = invoke(['scan', '-'], 'password=short private@example.org');
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.complete).toBe(true);
    expect(report.results[0].findings.length > 0).toBe(true);
    expect(result.stdout.includes('short')).toBe(false);
    expect(result.stdout.includes('private@example.org')).toBe(false);
  });
  it('never publishes input after a byte-limit or UTF-8 error', () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    for (const [args, input] of [
      [['redact', '-', '--max-bytes', '4'], 'password=secret'],
      [['redact', '-'], Buffer.from([0xc3, 0x28])],
    ]) {
      const result = invoke(args, input);
      expect(result.status).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr.includes('secret')).toBe(false);
    }
  });
  it('writes a private output atomically and refuses clobbering or same-path output', () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    workspace((root) => {
      const source = join(root, 'source.txt'),
        output = join(root, 'output.txt');
      writeFileSync(source, 'password=short');
      expect(invoke(['redact', source, '--output', output]).status).toBe(0);
      expect(readFileSync(output, 'utf8')).toBe('password=[REDACTED]');
      expect(readFileSync(source, 'utf8')).toBe('password=short');
      if (process.platform !== 'win32') {
        expect(statSync(output).mode & 0o777).toBe(0o600);
      }
      expect(invoke(['redact', source, '--output', output]).status).toBe(2);
      expect(invoke(['redact', source, '--output', source]).status).toBe(2);
      expect(invoke(['redact', source, '--in-place']).status).toBe(0);
      expect(readFileSync(source, 'utf8')).toBe('password=[REDACTED]');
    });
  });
  it('reports binary input as incomplete and does not corrupt it', () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    workspace((root) => {
      const binary = join(root, 'binary.dat');
      writeFileSync(binary, Buffer.from([0, 1, 2]));
      writeFileSync(join(root, 'text.txt'), 'safe');
      const result = invoke(['scan', root]);
      expect(result.status).toBe(2);
      expect(JSON.parse(result.stdout).complete).toBe(false);
      expect(readFileSync(binary)).toEqual(Buffer.from([0, 1, 2]));
    });
  });
  it('rejects symlinks and leaves destinations intact', () => {
    if (typeof Deno !== 'undefined' || process.platform === 'win32') {
      return;
    }
    workspace((root) => {
      const source = join(root, 'source.txt'),
        alias = join(root, 'alias.txt');
      writeFileSync(source, 'password=short');
      symlinkSync(source, alias);
      expect(invoke(['redact', alias, '--in-place']).status).toBe(2);
      expect(readFileSync(source, 'utf8')).toBe('password=short');
    });
  });
  it('validates config before creating output and hides malformed raw content', () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    workspace((root) => {
      const config = join(root, 'config.json'),
        output = join(root, 'out.txt');
      writeFileSync(config, '{"password":"DO-NOT-PRINT"');
      const result = invoke(
        ['redact', '-', '--config', config, '--output', output],
        'safe'
      );
      expect(result.status).toBe(2);
      expect(result.stderr.includes('DO-NOT-PRINT')).toBe(false);
      expect(existsSync(output)).toBe(false);
    });
  });
  it('uses reviewed config public contacts with the default engine', () => {
    if (typeof Deno !== 'undefined') {
      return;
    }
    workspace((root) => {
      const config = join(root, 'config.json');
      writeFileSync(
        config,
        JSON.stringify({
          publicEntities: [
            {
              type: 'EMAIL',
              value: 'press@example.org',
              source: 'https://example.org/contact',
              reviewedAt: '2026-10-07',
            },
          ],
        })
      );
      const result = invoke(
        ['redact', '-', '--config', config],
        'press@example.org private@example.org'
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('press@example.org [REDACTED]');
    });
  });
  it('does not echo unknown arguments that may themselves contain secrets', async () => {
    let output = '',
      errors = '';
    const status = await runCli(['redact', '-', '--token=PRIVATE'], {
      stdout: {
        write: (s) => {
          output += s;
        },
      },
      stderr: {
        write: (s) => {
          errors += s;
        },
      },
    });
    expect(status).toBe(2);
    expect(output).toBe('');
    expect(errors.includes('PRIVATE')).toBe(false);
  });
});

it('audits removed historical blobs and author metadata without rewriting any refs', async () => {
  if (typeof Deno !== 'undefined') {
    return;
  }
  const root = mkdtempSync(join(tmpdir(), 'sanitizer-history-'));
  const git = (args) =>
    spawnSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Synthetic Tester',
        GIT_AUTHOR_EMAIL: 'tester@example.org',
        GIT_COMMITTER_NAME: 'Synthetic Tester',
        GIT_COMMITTER_EMAIL: 'tester@example.org',
      },
    });
  try {
    expect(git(['init']).status).toBe(0);
    const file = join(root, 'log.txt');
    writeFileSync(file, 'password=historical');
    expect(git(['add', '.']).status).toBe(0);
    expect(git(['commit', '-m', 'add']).status).toBe(0);
    writeFileSync(file, 'safe');
    git(['add', '.']);
    git(['commit', '-m', 'remove']);
    const before = git(['rev-parse', 'HEAD']).stdout;
    const result = await auditGitHistory(root, {
      sanitizer: createSanitizer({ secretlint: false }),
    });
    expect(result.complete).toBe(true);
    expect(result.findings.some((record) => record.type === 'blob')).toBe(true);
    expect(result.findings.some((record) => record.type === 'commit')).toBe(
      true
    );
    expect(JSON.stringify(result).includes('historical')).toBe(false);
    expect(git(['rev-parse', 'HEAD']).stdout).toBe(before);
    expect(readFileSync(file, 'utf8')).toBe('safe');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
