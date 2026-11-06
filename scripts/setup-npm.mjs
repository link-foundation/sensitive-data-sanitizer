#!/usr/bin/env node

import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

/**
 * Keep the reviewed npm release available for OIDC trusted publishing.
 * The workflow normally installs it through the shared setup-node action;
 * these bounded fallback strategies also support older Node.js installations.
 *
 * Uses link-foundation libraries:
 * - Lockfile-installed command-stream and lino-arguments helpers
 * - command-stream: Modern shell command execution with streaming support
 */

export const NPM_MIN_VERSION = '12.2.2';
export const NODE_MIN_VERSION = '22.22.2';
export const NPM_TARGET_MAJOR = 12;
export const NPM_REGISTRY_METADATA_URL = 'https://registry.npmjs.org/npm';

export const compareVersions = semver.compare;

export function isVersionAtLeast(version, minimumVersion) {
  return semver.gte(version, minimumVersion);
}

export function isSupportedNpmVersion(version) {
  return isVersionAtLeast(version, NPM_MIN_VERSION);
}

export function isSupportedNodeVersion(version) {
  return semver.satisfies(version, '^22.22.2 || ^24.15.0 || >=26.0.0');
}

export function selectLatestSupportedNpmRelease(metadata) {
  const releases = Object.entries(metadata?.versions || {})
    .filter(([version, release]) => {
      const parsed = semver.parse(version);
      return (
        parsed &&
        parsed.major === NPM_TARGET_MAJOR &&
        parsed.prerelease.length === 0 &&
        isSupportedNpmVersion(version) &&
        release?.dist?.tarball
      );
    })
    .sort(([leftVersion], [rightVersion]) =>
      compareVersions(rightVersion, leftVersion)
    );

  if (releases.length === 0) {
    throw new Error(
      `No npm ${NPM_TARGET_MAJOR}.x release found at or above ${NPM_MIN_VERSION}`
    );
  }

  const [version, release] = releases[0];
  return { version, tarballUrl: release.dist.tarball };
}

async function fetchNpmRegistryMetadata(fetchFn) {
  const response = await fetchFn(NPM_REGISTRY_METADATA_URL, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch npm registry metadata: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

async function resolveLatestSupportedNpmRelease(fetchFn) {
  const metadata = await fetchNpmRegistryMetadata(fetchFn);
  return selectLatestSupportedNpmRelease(metadata);
}

// Update npm for OIDC trusted publishing (requires >= 11.5.1)
// Pin the reviewed release consistently across every installation strategy
//
// Known issue: Node.js 22.22.2 on GitHub Actions (ubuntu-24.04 image >= 20260329.72.1)
// ships with a broken npm 10.9.7 that is missing the 'promise-retry' module,
// causing `npm install -g` to fail with MODULE_NOT_FOUND.
// See: https://github.com/actions/runner-images/issues/13883
// See: https://github.com/nodejs/node/issues/62430
// See: https://github.com/npm/cli/issues/9151
//
// Workaround strategies in order of preference:
// 1. npm install -g npm@12.2.2 (standard approach)
// 2. curl tarball download (bypasses broken npm entirely)
// 3. npx npm@12.2.2 install (uses npx cache, bypasses arborist)

async function tryStandardInstall($) {
  await $`npm install -g npm@12.2.2`;
}

async function tryCurlTarball($, fetchFn) {
  const npmRelease = await resolveLatestSupportedNpmRelease(fetchFn);
  console.log(`Downloading npm ${npmRelease.version} tarball...`);

  const nodeDir = (
    await $`dirname $(dirname $(which node))`.run({ capture: true })
  ).stdout.trim();
  const globalNpmDir = `${nodeDir}/lib/node_modules/npm`;
  const tempNpmDir = '/tmp/setup-npm-package';
  const tarball = '/tmp/setup-npm-package.tgz';

  // Download to a file, not straight into the extractor: a mid-transfer
  // truncation (curl exit 18) must not leave a half-populated directory, and
  // a retried piped transfer can hand the extractor the head of the archive
  // twice. `--retry` alone does not cover exit 18; `--retry-all-errors` is
  // what retries it.
  await $`rm -f "${tarball}"`;
  await $`curl -fsSL --retry 3 --retry-delay 2 --retry-all-errors "${npmRelease.tarballUrl}" -o "${tarball}"`;
  await $`rm -rf "${tempNpmDir}" && mkdir -p "${tempNpmDir}"`;
  await $`tar xz --strip-components=1 -C "${tempNpmDir}" -f "${tarball}"`;
  await $`rm -rf "${globalNpmDir}" && mv "${tempNpmDir}" "${globalNpmDir}"`;
}

async function tryNpxInstall($) {
  await $`npx --yes npm@12.2.2 install -g npm@12.2.2`;
}

async function tryStrategy(name, fn) {
  try {
    await fn();
    return true;
  } catch (error) {
    console.warn(`Warning: ${name} failed: ${error.message}`);
    return false;
  }
}

function failUnsupportedNodeVersion(nodeVersion) {
  console.error(
    `ERROR: Node.js ${NODE_MIN_VERSION} or later is required for npm OIDC trusted publishing setup.`
  );
  console.error(`Current Node.js version is ${nodeVersion}.`);
  process.exit(1);
}

function failUnsupportedNpmVersion(npmVersion) {
  console.error(
    `ERROR: Could not update npm to >= ${NPM_MIN_VERSION} for OIDC trusted publishing.`
  );
  console.error(`Current npm version ${npmVersion} does not support OIDC.`);
  console.error('See: https://github.com/actions/runner-images/issues/13883');
  process.exit(1);
}

export async function setupNpm($, fetchFn = fetch) {
  const nodeVersion = process.version;
  console.log(`Current Node.js version: ${nodeVersion}`);

  if (!isSupportedNodeVersion(nodeVersion)) {
    failUnsupportedNodeVersion(nodeVersion);
  }

  const currentResult = await $`npm --version`.run({ capture: true });
  const currentVersion = currentResult.stdout.trim();
  console.log(`Current npm version: ${currentVersion}`);

  if (isSupportedNpmVersion(currentVersion)) {
    console.log(
      'Current npm version satisfies the reviewed tooling requirement'
    );
    return;
  }

  const strategies = [
    ['npm install -g npm@12.2.2', () => tryStandardInstall($)],
    ['curl-based tarball download', () => tryCurlTarball($, fetchFn)],
    ['npx-based install', () => tryNpxInstall($)],
  ];

  let success = false;
  for (const [name, fn] of strategies) {
    console.log(`Trying ${name}...`);
    success = await tryStrategy(name, fn);
    if (success) {
      break;
    }
    console.warn(
      'This may be the Node.js 22.22.2 broken npm issue (actions/runner-images#13883).'
    );
  }

  if (!success) {
    if (isSupportedNpmVersion(currentVersion)) {
      console.log(
        'Current npm version already supports OIDC trusted publishing'
      );
    }
  }

  const updatedResult = await $`npm --version`.run({ capture: true });
  const updatedVersion = updatedResult.stdout.trim();
  console.log(`Updated npm version: ${updatedVersion}`);

  if (!isSupportedNpmVersion(updatedVersion)) {
    failUnsupportedNpmVersion(updatedVersion);
  }
}

function isMainModule() {
  return process.argv[1]
    ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;
}

if (isMainModule()) {
  try {
    if (!isSupportedNodeVersion(process.version)) {
      failUnsupportedNodeVersion(process.version);
    }

    // Load command-stream dynamically only for CLI execution, so tests can
    // import the pure version helpers without fetching dependencies or
    // mutating npm.
    const { loadCommandStream } = await import('./use-module.mjs');
    const { $ } = await loadCommandStream();

    await setupNpm($);
  } catch (error) {
    console.error('Error updating npm:', error.message);
    process.exit(1);
  }
}
