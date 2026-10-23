import { it, expect } from 'test-anywhere';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { knownSecretsFromGitHubConfig, sanitize } from '../src/index.js';
it('reads all gh hosts and account tokens with YAML quoting, deduplication and no diagnostics', async () => {
  if (
    typeof Deno !== 'undefined' &&
    (await Deno.permissions.query({ name: 'write', path: tmpdir() })).state !==
      'granted'
  ) {
    return;
  }
  const dir = await mkdtemp(join(tmpdir(), 'gh-config-'));
  const path = join(dir, 'hosts.yml');
  try {
    expect(await knownSecretsFromGitHubConfig({ path })).toEqual([]);
    await writeFile(
      path,
      `github.com:\n  oauth_token: "opaque:first"\n  users:\n    user-one:\n      oauth_token: 'opaque''second'\nenterprise.example:\n  api_token: opaque-third # comment\n  oauth_token: "opaque:first"\n`
    );
    const knownSecrets = await knownSecretsFromGitHubConfig({ path });
    expect(knownSecrets.sort()).toEqual(
      ['opaque-third', 'opaque:first', "opaque'second"].sort()
    );
    for (const value of knownSecrets) {
      expect(sanitize(value, { knownSecrets }).text).toBe('[REDACTED]');
    }
    const originalWarn = console.warn;
    const originalEmitWarning = process.emitWarning;
    let warnings = 0;
    console.warn = () => {
      warnings++;
    };
    process.emitWarning = () => {
      warnings++;
    };
    try {
      await writeFile(
        path,
        'github.com:\n  oauth_token: !unknown opaque-private-value\n'
      );
      expect(await knownSecretsFromGitHubConfig({ path })).toEqual([
        'opaque-private-value',
      ]);
    } finally {
      console.warn = originalWarn;
      process.emitWarning = originalEmitWarning;
    }
    expect(warnings).toBe(0);
    for (const yaml of [
      'x: [broken',
      'x: &x {oauth_token: secret, again: *x}',
    ]) {
      await writeFile(path, yaml);
      let error;
      try {
        await knownSecretsFromGitHubConfig({ path });
      } catch (caught) {
        error = caught;
      }
      expect(error.code).toBe('ERR_AUTH');
      expect(error.message.includes('secret')).toBe(false);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
