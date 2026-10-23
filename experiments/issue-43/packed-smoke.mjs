// Verify the actual tarball from a clean consumer directory, without publishing.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const workspace = mkdtempSync(join(tmpdir(), 'sanitizer-issue-43-pack-'));
try {
  const packed = JSON.parse(
    execFileSync(
      'npm',
      ['pack', '--json', '--ignore-scripts', '--pack-destination', workspace],
      {
        cwd: root,
        encoding: 'utf8',
      }
    )
  )[0];
  for (const path of [
    'src/log-bytes.js',
    'src/index.d.ts',
    'examples/shared-tool-logs.mjs',
  ]) {
    if (!packed.files.some((entry) => entry.path === path)) {
      throw new Error(`Missing packed file: ${path}`);
    }
  }
  writeFileSync(
    join(workspace, 'package.json'),
    '{"private":true,"type":"module"}'
  );
  execFileSync(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      join(workspace, packed.filename),
    ],
    {
      cwd: workspace,
      stdio: 'inherit',
    }
  );
  writeFileSync(
    join(workspace, 'check.mjs'),
    `
import assert from 'node:assert/strict';
import { createSanitizer, decodeLogBytes, encodeLogText, knownSecretsFromEnv, knownSecretsFromGitHubConfig } from '@link-foundation/sensitive-data-sanitizer';
const secret = 'fixture-local-value-42';
const values = knownSecretsFromEnv({ CUSTOM_AUTH: secret });
assert.deepEqual(values, [secret]);
const sanitizer = createSanitizer({ credentialsOnly: true, knownSecrets: values });
const result = await sanitizer.sanitize('public@example.com ' + secret);
assert.equal(result.text, 'public@example.com [REDACTED]');
const bytes = Buffer.from([0xff, 0xc3, 0x28, 0xf0, 0x9f, 0x99, 0x82]);
assert.deepEqual(encodeLogText(decodeLogBytes(bytes)), bytes);
assert.equal(typeof knownSecretsFromGitHubConfig, 'function');
console.log('Packed library exports, scanner union and byte round trip pass');
`
  );
  execFileSync(process.execPath, [join(workspace, 'check.mjs')], {
    cwd: workspace,
    stdio: 'inherit',
  });
  const manifest = JSON.parse(
    readFileSync(
      join(
        workspace,
        'node_modules/@link-foundation/sensitive-data-sanitizer/package.json'
      )
    )
  );
  for (const entry of Object.values(manifest.bin)) {
    execFileSync(
      process.execPath,
      [
        join(
          workspace,
          'node_modules/@link-foundation/sensitive-data-sanitizer',
          entry
        ),
        '--help',
      ],
      { cwd: workspace, stdio: 'pipe' }
    );
  }
  console.log(
    `Packed ${packed.files.length} files; both CLI entry points pass`
  );
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
