// Verify an actual packed installation, both npm bins, and required scanners.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const archive = resolve(process.argv[2]);
const directory = mkdtempSync(join(tmpdir(), 'sanitizer-package-smoke-'));
try {
  execFileSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', archive],
    { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const execute = (command, args, input) =>
    execFileSync(command, args, {
      cwd: directory,
      input,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    }).trim();
  const binary = join(directory, 'node_modules/.bin/sensitive-data-sanitizer');
  const output = execute(
    process.execPath,
    [binary, 'redact', '-'],
    'password=short'
  );
  if (output !== 'password=[REDACTED]') {
    throw new Error('Installed CLI did not redact the synthetic credential.');
  }
  const legacy = join(directory, 'node_modules/.bin/example-package-name');
  if (execute(process.execPath, [legacy, 'add', '2', '3']) !== '5') {
    throw new Error('Installed arithmetic CLI failed.');
  }
  const api = execute(process.execPath, [
    '--input-type=module',
    '-e',
    "import { createSanitizer } from '@link-foundation/sensitive-data-sanitizer'; const result = await createSanitizer().sanitize('password=short'); console.log(result.text);",
  ]);
  if (api !== output) {
    throw new Error('Installed API and CLI differ.');
  }
  console.log(
    JSON.stringify({
      package: 'installed',
      cli: 'passed',
      api: 'passed',
      legacy: 'passed',
    })
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
