#!/usr/bin/env node
// Show how long npm waits on a registry that accepts requests but never
// answers, with and without a bounded fetch timeout (issue 208).
//
// Usage: node experiments/issue-208/npm-fetch-stall.mjs [TIMEOUT_MS] [CAP_S]
//
// Starts a loopback HTTP server that holds every request open, then runs
// `npm view npm@12.2.2 version` against it in an empty temporary directory:
//   1. with npm's defaults (fetch-timeout 300000), killed after CAP_S seconds;
//   2. with the flags scripts/install-reviewed-npm.sh passes, using
//      TIMEOUT_MS (default 2000) to keep the run short.
// Nothing is fetched from the network.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const timeoutMs = Number(process.argv[2] ?? 2000);
const capSeconds = Number(process.argv[3] ?? 20);
let requests = 0;
const held = [];
const server = createServer((request, response) => {
  requests += 1;
  held.push(response); // never answered
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const registry = `http://127.0.0.1:${server.address().port}/`;
const cwd = mkdtempSync(join(tmpdir(), 'npm-fetch-stall-'));

function run(label, flags) {
  requests = 0;
  const started = Date.now();
  return new Promise((done) => {
    const child = spawn(
      'npm',
      [
        'view',
        'npm@12.2.2',
        'version',
        `--registry=${registry}`,
        `--cache=${join(cwd, 'cache')}`,
        '--prefer-online',
        ...flags,
      ],
      { cwd, stdio: ['ignore', 'ignore', 'pipe'] }
    );
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const cap = setTimeout(() => child.kill('SIGKILL'), capSeconds * 1000);
    child.on('close', (status, signal) => {
      clearTimeout(cap);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      const outcome = signal
        ? `killed at the ${capSeconds}s cap`
        : `exit ${status}`;
      const error = stderr.match(/npm error code \S+/)?.[0] ?? '';
      console.log(
        `${label}: ${outcome} after ${seconds}s, ${requests} request(s) ${error}`
      );
      done();
    });
  });
}

try {
  await run('npm defaults', []);
  await run(`bounded (fetch-timeout ${timeoutMs})`, [
    `--fetch-timeout=${timeoutMs}`,
    '--fetch-retries=3',
    '--fetch-retry-mintimeout=1000',
    '--fetch-retry-maxtimeout=5000',
  ]);
} finally {
  for (const response of held) {
    response.destroy();
  }
  server.close();
  rmSync(cwd, { recursive: true, force: true });
}
