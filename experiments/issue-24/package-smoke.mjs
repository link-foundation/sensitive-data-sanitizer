import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, openSync, closeSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const directory = mkdtempSync(join(tmpdir(), 'sanitizer-package-'));
mkdirSync(join(root, 'ci-logs'), { recursive: true });
const log = openSync(join(root, 'ci-logs/package-install.log'), 'w');
try {
  const [archive] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', directory], {
      cwd: root,
      encoding: 'utf8',
    })
  );
  execFileSync(
    'npm',
    [
      'install',
      '--prefix',
      directory,
      '--ignore-scripts',
      '--no-audit',
      join(directory, archive.filename),
    ],
    { stdio: ['ignore', log, log] }
  );
  const source = `
    import {createSanitizer, sanitizeStream} from '@link-foundation/sensitive-data-sanitizer';
    const engine = createSanitizer({transformation:{mode:'fake', key:'private-package-fixture-key'}});
    const result = await engine.sanitize('Applicant: Marina Kovaleva; password=short-private');
    if (result.text.includes('Kovaleva') || result.text.includes('short-private')) throw new Error('Private data survived');
    let output = '';
    for await (const chunk of sanitizeStream(['{"password":"short-private"}\\n'], {structured:'jsonl', workers:2})) output += chunk;
    if (JSON.parse(output).password !== '[REDACTED]') throw new Error('Packed workers failed');
  `;
  execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: directory,
    stdio: ['ignore', log, log],
  });
  const help = execFileSync(
    process.execPath,
    [
      join(
        directory,
        'node_modules/@link-foundation/sensitive-data-sanitizer/bin/sensitive-data-sanitizer.js'
      ),
      '--help',
    ],
    { encoding: 'utf8' }
  );
  if (!help.includes('--jsonl')) {
    throw new Error('Packed CLI failed');
  }
  console.log(
    'Installed tarball: fake mode, default engines, parallel JSONL workers and CLI passed.'
  );
} finally {
  closeSync(log);
  rmSync(directory, { recursive: true, force: true });
}
