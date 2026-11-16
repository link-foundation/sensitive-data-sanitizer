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

// A fake npm models a Windows runner image: the shims next to node run the
// npm under the configured global prefix when one is installed there, and
// otherwise the npm in the Node directory. A nested `npm` (npm_config_prefix
// pointing elsewhere) always runs the Node directory's npm.
function makeRunner({ configured, bundled, nodeCliUpdatesBundled = true }) {
  const root = mkdtempSync(path.join(tmpdir(), 'install-reviewed-npm-'));
  const bin = path.join(root, 'bin');
  const state = path.join(root, 'state');
  // npm's global layout differs: <node dir>/node_modules on Windows and
  // <node dir>/../lib/node_modules elsewhere. Provide both.
  const nodeDir = path.join(root, 'node', 'bin');
  const nodePrefix =
    process.platform === 'win32' ? nodeDir : path.dirname(nodeDir);
  const nodeClis = [
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(root, 'node', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  mkdirSync(bin);
  mkdirSync(state);
  for (const cli of nodeClis) {
    mkdirSync(path.dirname(cli), { recursive: true });
  }
  writeFileSync(path.join(state, 'configured'), configured);
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
      '    if [ -z "${npm_config_prefix:-}" ] && [ -s "$state/configured" ]; then cat "$state/configured"; else cat "$state/bundled"; fi ;;',
      '  install) printf %s "${3#npm@}" >"$state/configured" ;;',
      'esac',
      '',
    ].join('\n')
  );
  chmodSync(npm, 0o755);
  const nodeCliSource = [
    "const { appendFileSync, writeFileSync } = require('node:fs');",
    'const args = process.argv.slice(2);',
    `appendFileSync(${JSON.stringify(path.join(state, 'calls'))}, 'node-dir-npm ' + args.join(' ') + '\\n');`,
    nodeCliUpdatesBundled
      ? `writeFileSync(${JSON.stringify(path.join(state, 'bundled'))}, args.find((arg) => arg.startsWith('npm@')).slice(4));`
      : '',
    '',
  ].join('\n');
  for (const cli of nodeClis) {
    writeFileSync(cli, nodeCliSource);
  }
  const env = {
    ...process.env,
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    RUNNER_TEMP: root,
    RUNNER_DEBUG: '',
    INSTALL_NPM_VERBOSE: '',
    INSTALL_NPM_NODE_DIR: nodeDir,
  };

  const run = (args, extraEnv = {}) => {
    const result = spawnSync('bash', [scriptPath, ...args], {
      encoding: 'utf8',
      env: { ...env, ...extraEnv },
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

// Each registry request is bounded and retried quickly: npm's default
// 300s fetch timeout outlasts the step's 90s budget.
const INSTALL_FLAGS =
  '--ignore-scripts --no-audit --no-fund --fetch-timeout=10000 --fetch-retries=3 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=5000';
const NODE_DIR_INSTALL = (prefix) =>
  `node-dir-npm install --global --prefix ${prefix} npm@12.2.2 ${INSTALL_FLAGS}\n`;
const CONFIGURED_PREFIX_INSTALL = `npm install --global npm@12.2.2 ${INSTALL_FLAGS}\n`;

describe('install-reviewed-npm.sh', () => {
  itUnless(sandboxed, noPosixShell)(
    'needs one install when the configured prefix holds no npm',
    () => {
      const runner = makeRunner({ configured: '', bundled: '11.20.0' });
      try {
        const result = runner.run(['12.2.2']);

        expect(result.status).toBe(0);
        // Installed into the Node installation itself, by its own npm.
        expect(result.calls).toContain(NODE_DIR_INSTALL(runner.nodePrefix));
        expect(result.calls).not.toContain(CONFIGURED_PREFIX_INSTALL);
        expect(result.output).toContain(
          'npm 12.2.2 is in effect for top-level and nested npm commands.'
        );
      } finally {
        runner.cleanup();
      }
    }
  );

  itUnless(sandboxed, noPosixShell)(
    'also replaces an npm installed under the configured prefix',
    () => {
      const runner = makeRunner({ configured: '11.20.0', bundled: '11.20.0' });
      try {
        const result = runner.run(['12.2.2']);

        expect(result.status).toBe(0);
        expect(result.calls).toContain(NODE_DIR_INSTALL(runner.nodePrefix));
        expect(result.calls).toContain(CONFIGURED_PREFIX_INSTALL);
      } finally {
        runner.cleanup();
      }
    }
  );

  itUnless(sandboxed, noPosixShell)(
    'logs each registry request and honors a fetch timeout when tracing',
    () => {
      const runner = makeRunner({ configured: '', bundled: '11.20.0' });
      try {
        const result = runner.run(['12.2.2'], {
          INSTALL_NPM_VERBOSE: '1',
          INSTALL_NPM_FETCH_TIMEOUT_MS: '9000',
        });

        expect(result.status).toBe(0);
        expect(result.calls).toContain(
          `npm@12.2.2 ${INSTALL_FLAGS.replace('=10000', '=9000')} --loglevel=http\n`
        );
        expect(result.output).toContain('[install-npm] installing into');
      } finally {
        runner.cleanup();
      }
    }
  );

  itUnless(sandboxed, noPosixShell)(
    'installs nothing when every npm already is the reviewed release',
    () => {
      const runner = makeRunner({ configured: '', bundled: '12.2.2' });
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
        configured: '11.20.0',
        bundled: '11.20.0',
        nodeCliUpdatesBundled: false,
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
    const runner = makeRunner({ configured: '', bundled: '12.2.2' });
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
