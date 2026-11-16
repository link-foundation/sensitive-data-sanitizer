import { describe, expect, it } from 'test-anywhere';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { parse } from 'yaml';
import { itUnless, noPosixShell, sandboxed } from './helpers/skip.js';

const scriptPath = fileURLToPath(
  new URL('../scripts/install-reviewed-npm.sh', import.meta.url)
);

// A fake npm models a Windows runner image: the global prefix
// is separate from the Node installation, so `npm install --global` changes
// what the top-level `npm` runs but not the copy a nested `npm` falls back to
// once npm_config_prefix points elsewhere.
function makeRunner({ top, bundled, reviewedCliUpdatesBundled = true }) {
  const root = mkdtempSync(path.join(tmpdir(), 'install-reviewed-npm-'));
  const bin = path.join(root, 'bin');
  const state = path.join(root, 'state');
  const globalPrefix = path.join(root, 'global');
  // npm's global layout differs: <prefix>/node_modules on Windows and
  // <prefix>/lib/node_modules elsewhere. Provide both.
  const reviewedClis = [
    path.join(globalPrefix, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(globalPrefix, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  mkdirSync(bin);
  mkdirSync(state);
  for (const cli of reviewedClis) {
    mkdirSync(path.dirname(cli), { recursive: true });
  }
  writeFileSync(path.join(state, 'top'), top);
  writeFileSync(path.join(state, 'bundled'), bundled);
  writeFileSync(path.join(state, 'calls'), '');

  const npm = path.join(bin, 'npm');
  writeFileSync(
    npm,
    [
      '#!/usr/bin/env bash',
      `state='${state}'`,
      'echo "npm $*" >>"$state/calls"',
      'case "$1" in',
      '  --version)',
      '    if [ -n "${npm_config_prefix:-}" ]; then cat "$state/bundled"; else cat "$state/top"; fi ;;',
      `  prefix) echo '${globalPrefix}' ;;`,
      '  install) printf %s "${3#npm@}" >"$state/top" ;;',
      'esac',
      '',
    ].join('\n')
  );
  chmodSync(npm, 0o755);
  const reviewedSource = [
    "const { appendFileSync, writeFileSync } = require('node:fs');",
    'const args = process.argv.slice(2);',
    `appendFileSync(${JSON.stringify(path.join(state, 'calls'))}, 'reviewed ' + args.join(' ') + '\\n');`,
    reviewedCliUpdatesBundled
      ? `writeFileSync(${JSON.stringify(path.join(state, 'bundled'))}, args.find((arg) => arg.startsWith('npm@')).slice(4));`
      : '',
    '',
  ].join('\n');
  for (const cli of reviewedClis) {
    writeFileSync(cli, reviewedSource);
  }
  const env = {
    ...process.env,
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    RUNNER_TEMP: root,
    RUNNER_DEBUG: '',
    INSTALL_NPM_VERBOSE: '',
  };
  // The script installs into the prefix of whichever `node` it finds; ask
  // the same node (Bun and Deno run this file with their own execPath).
  const nodePrefix = spawnSync(
    'node',
    [
      '-p',
      "const p = require('node:path'); const d = p.dirname(process.execPath); process.platform === 'win32' ? d : p.dirname(d)",
    ],
    { encoding: 'utf8', env }
  ).stdout.trim();

  const run = (args) => {
    const result = spawnSync('bash', [scriptPath, ...args], {
      encoding: 'utf8',
      env,
    });
    return {
      status: result.status,
      output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
      calls: readFileSync(path.join(state, 'calls'), 'utf8'),
    };
  };

  return {
    run,
    nodePrefix,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

describe('install-reviewed-npm.sh', () => {
  itUnless(sandboxed, noPosixShell)(
    'replaces the npm that nested --prefix scripts fall back to',
    () => {
      const runner = makeRunner({ top: '11.20.0', bundled: '11.20.0' });
      try {
        const result = runner.run(['12.2.2']);

        expect(result.status).toBe(0);
        expect(result.calls).toContain(
          'npm install --global npm@12.2.2 --ignore-scripts --no-audit --no-fund'
        );
        // Installed into the Node installation itself, by the reviewed npm.
        expect(result.calls).toContain(
          `reviewed install --global --prefix ${runner.nodePrefix} npm@12.2.2 --ignore-scripts --no-audit --no-fund`
        );
        expect(result.output).toContain(
          'npm 12.2.2 is in effect for top-level and nested npm commands.'
        );
      } finally {
        runner.cleanup();
      }
    }
  );

  itUnless(sandboxed, noPosixShell)(
    'installs nothing when every npm already is the reviewed release',
    () => {
      const runner = makeRunner({ top: '12.2.2', bundled: '12.2.2' });
      try {
        const result = runner.run(['12.2.2']);

        expect(result.status).toBe(0);
        expect(result.calls).not.toContain('install');
      } finally {
        runner.cleanup();
      }
    }
  );

  itUnless(sandboxed, noPosixShell)(
    'fails with a titled error when a nested npm still is not reviewed',
    () => {
      const runner = makeRunner({
        top: '11.20.0',
        bundled: '11.20.0',
        reviewedCliUpdatesBundled: false,
      });
      try {
        const result = runner.run(['12.2.2']);

        expect(result.status).toBe(1);
        expect(result.output).toContain(
          '::error title=Reviewed npm is not in effect::'
        );
        expect(result.output).toContain(
          'npm under another --prefix is 11.20.0'
        );
      } finally {
        runner.cleanup();
      }
    }
  );

  itUnless(sandboxed, noPosixShell)('rejects a version range', () => {
    const runner = makeRunner({ top: '12.2.2', bundled: '12.2.2' });
    try {
      expect(runner.run(['^12']).status).toBe(2);
    } finally {
      runner.cleanup();
    }
  });
});

describe('setup-node composite action', () => {
  const action = parse(
    readFileSync('.github/actions/setup-node/action.yml', 'utf8')
  );

  it('installs the reviewed npm through the budgeted, verifying script', () => {
    const install = action.runs.steps.find(
      (step) => step.name === 'Install reviewed npm'
    );

    expect(install.run).toMatch(
      /run-with-budget-warning\.sh \d+ "Reviewed npm install" bash scripts\/install-reviewed-npm\.sh \d+\.\d+\.\d+/
    );
  });

  it('turns on npm request logging only for debug re-runs', () => {
    const debug = action.runs.steps.find(
      (step) => step.name === 'Enable npm debug logging'
    );

    expect(debug.if).toBe("runner.debug == '1'");
    expect(debug.run).toContain('NPM_CONFIG_LOGLEVEL=');
  });
});
