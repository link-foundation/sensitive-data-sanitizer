import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fromGitleaks, fromTrufflehog, fromPresidio } from './adapters.js';
import { readTextFile } from './files.js';
import { failure } from './detection.js';

function run(
  command,
  args,
  input,
  { timeoutMs = 30000, maxOutputBytes = 10 * 1024 * 1024 } = {}
) {
  if (
    typeof command !== 'string' ||
    !command ||
    !Array.isArray(args) ||
    args.some((a) => typeof a !== 'string') ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isSafeInteger(maxOutputBytes) ||
    maxOutputBytes <= 0
  ) {
    throw failure('ERR_CONFIG');
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });
    const chunks = [];
    let size = 0,
      failed = false;
    const timer = setTimeout(() => {
      failed = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxOutputBytes) {
        failed = true;
        child.kill('SIGKILL');
      } else {
        chunks.push(chunk);
      }
    });
    child.stderr.on('data', () => {}); // Scanner diagnostics can contain credentials.
    child.stdin.on('error', () => {
      failed = true;
    });
    child.on('error', () => {
      failed = true;
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (failed || code !== 0) {
        reject(failure('ERR_ENGINE'));
      } else {
        resolve(Buffer.concat(chunks).toString('utf8'));
      }
    });
    child.stdin.end(input);
  });
}

export function createGitleaksDetector({
  command = 'gitleaks',
  timeoutMs,
  maxOutputBytes,
} = {}) {
  return {
    id: 'gitleaks',
    async detect(text) {
      const directory = await mkdtemp(join(tmpdir(), 'sanitizer-gitleaks-'));
      const report = join(directory, 'report.json');
      try {
        await run(
          command,
          [
            'stdin',
            '--no-banner',
            '--log-level',
            'error',
            '--ignore-gitleaks-allow',
            '--exit-code',
            '0',
            '--report-format',
            'json',
            '--report-path',
            report,
          ],
          text,
          { timeoutMs, maxOutputBytes }
        );
        const json = await readTextFile(
          report,
          maxOutputBytes ?? 10 * 1024 * 1024
        );
        return fromGitleaks(text, JSON.parse(json));
      } catch {
        throw failure('ERR_ENGINE');
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}

export function createTrufflehogDetector({
  command = 'trufflehog',
  timeoutMs,
  maxOutputBytes,
} = {}) {
  return {
    id: 'trufflehog',
    async detect(text) {
      const directory = await mkdtemp(join(tmpdir(), 'sanitizer-trufflehog-'));
      const input = join(directory, 'input.txt');
      try {
        await writeFile(input, text, { mode: 0o600 });
        const output = await run(
          command,
          ['filesystem', input, '--json', '--no-verification', '--no-update'],
          undefined,
          { timeoutMs, maxOutputBytes }
        );
        const report = output
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line));
        return fromTrufflehog(text, report);
      } catch {
        throw failure('ERR_ENGINE');
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}

// A local Presidio bridge accepts text on stdin and emits its AnalyzerResult
// list as JSON. Model installation and language choice belong to the caller.
export function createPresidioDetector({
  command = 'python3',
  args,
  timeoutMs,
  maxOutputBytes,
} = {}) {
  if (!Array.isArray(args)) {
    throw failure('ERR_CONFIG');
  }
  return {
    id: 'presidio',
    async detect(text) {
      try {
        return fromPresidio(
          text,
          JSON.parse(
            await run(command, args, text, { timeoutMs, maxOutputBytes })
          )
        );
      } catch {
        throw failure('ERR_ENGINE');
      }
    },
  };
}
