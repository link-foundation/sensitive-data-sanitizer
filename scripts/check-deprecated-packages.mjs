#!/usr/bin/env node
/**
 * Ask the npm registry whether any locked package version is deprecated.
 *
 * npm copies `deprecated` into package-lock.json only when it resolves a
 * package, so a version deprecated after the lockfile was written stays
 * invisible to tests/deprecated-packages.test.js until the next lockfile
 * update. This reads every registry-resolved name@version from the given
 * lockfiles and fetches its version document (a few KiB each), which carries
 * the current `deprecated` message.
 *
 * - Every deprecated version is annotated and listed in the step summary.
 * - DEPRECATED_FAIL=true turns them into errors and a failing exit code; the
 *   scheduled run sets it, so a fresh deprecation turns the weekly run red
 *   without blocking unrelated pull requests.
 * - A registry error (after retries), a missing version or an unreadable
 *   lockfile always fails: the check never reports "clean" without an answer
 *   for every package.
 * - DEPRECATED_VERBOSE=1 (or RUNNER_DEBUG=1) logs each request and retry.
 *
 * Usage: node scripts/check-deprecated-packages.mjs [package-lock.json ...]
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_NPM_REGISTRY_URL,
  buildPackageVersionUrl,
} from './npm-registry.mjs';

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
/** A registry tarball: `<registry>/<name>/-/<file>.tgz`. */
const REGISTRY_TARBALL = /^https?:\/\/[^\s]+\/-\/[^/]+\.tgz$/;

/**
 * Unique registry packages in a parsed package-lock.json (v2/v3).
 * Only installed `node_modules/` entries count: the root project, local
 * package directories, workspace links, bundled packages, and git or non-registry
 * tarball dependencies have no registry version document and are skipped.
 * @param {{packages?: Record<string, any>}} lock
 * @returns {{name: string, version: string, paths: string[]}[]}
 */
export function collectPackages(lock) {
  if (!lock || typeof lock.packages !== 'object') {
    throw new Error('lockfile has no "packages" map (lockfileVersion >= 2)');
  }
  const found = new Map();
  for (const [path, info] of Object.entries(lock.packages)) {
    if (
      !path.includes('node_modules/') ||
      info.link ||
      info.inBundle ||
      !info.version
    ) {
      continue;
    }
    if (info.resolved && !REGISTRY_TARBALL.test(info.resolved)) {
      continue;
    }
    const name = info.name || path.replace(/^.*node_modules\//, '');
    const key = `${name}@${info.version}`;
    const entry = found.get(key) || { name, version: info.version, paths: [] };
    entry.paths.push(path);
    found.set(key, entry);
  }
  return [...found.values()].sort((a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`)
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function permanent(message) {
  return Object.assign(new Error(message), { permanent: true });
}

/** Deprecation message from one registry response; throws on a bad answer. */
async function readDeprecation(response, name, version) {
  if (response.status === 404) {
    throw permanent(`${name}@${version} is not in the registry (404)`);
  }
  if (!response.ok) {
    const error = new Error(
      `${name}@${version}: registry answered ${response.status} ${response.statusText}`
    );
    error.permanent = !RETRYABLE_STATUS.has(response.status);
    throw error;
  }
  const manifest = await response.json();
  if (manifest?.version !== version) {
    throw permanent(`${name}@${version}: registry returned another version`);
  }
  return typeof manifest.deprecated === 'string' ? manifest.deprecated : '';
}

/**
 * Current deprecation message of one version, or '' when it is not
 * deprecated. Retries transient failures with a per-request timeout.
 */
export async function fetchDeprecation(
  { name, version },
  {
    fetchFn = fetch,
    registryUrl = DEFAULT_NPM_REGISTRY_URL,
    retries = 3,
    timeoutMs = 15000,
    backoffMs = 1000,
    log = () => {},
  } = {}
) {
  const url = buildPackageVersionUrl(name, version, registryUrl);
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      log(`GET ${url} (attempt ${attempt}/${retries})`);
      const response = await fetchFn(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      return await readDeprecation(response, name, version);
    } catch (error) {
      lastError = error;
      if (error.permanent || attempt === retries) {
        break;
      }
      log(`retrying ${name}@${version}: ${error.message}`);
      await sleep(backoffMs * attempt);
    }
  }
  throw lastError;
}

/** Run `task` over `items` with at most `limit` in flight. */
async function mapLimit(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await task(items[index]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

/**
 * @returns {Promise<{checked: number, deprecated: object[], errors: string[]}>}
 */
export async function checkPackages(packages, options = {}) {
  const { concurrency = 8 } = options;
  const results = await mapLimit(packages, concurrency, async (pkg) => {
    try {
      return { pkg, message: await fetchDeprecation(pkg, options) };
    } catch (error) {
      return { pkg, error: error.message };
    }
  });
  return {
    checked: packages.length,
    deprecated: results
      .filter((result) => result.message)
      .map(({ pkg, message }) => ({ ...pkg, message })),
    errors: results.filter((result) => result.error).map((r) => r.error),
  };
}

function escapeData(text) {
  return String(text)
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
}

function escapeProperty(text) {
  return escapeData(text).replaceAll(':', '%3A').replaceAll(',', '%2C');
}

function escapeCell(text) {
  return String(text).replaceAll('|', '\\|').replace(/\s+/g, ' ');
}

/** Annotations, summary markdown and exit code for one lockfile. */
export function render(lockfile, result, { fail = false } = {}) {
  const title = escapeProperty(`deprecated packages (${lockfile})`);
  const command = fail ? 'error' : 'warning';
  const annotations = [
    ...result.deprecated.map(
      (pkg) =>
        `::${command} file=${escapeProperty(lockfile)},title=${title}::${escapeData(
          `${pkg.name}@${pkg.version} is deprecated: ${pkg.message}`
        )}`
    ),
    ...result.errors.map(
      (error) => `::error title=${title}::${escapeData(error)}`
    ),
  ];
  const lines = [
    `### Deprecated packages: \`${lockfile}\``,
    '',
    `Checked ${result.checked} locked registry versions: ${result.deprecated.length} deprecated, ${result.errors.length} unanswered.`,
    '',
  ];
  if (result.deprecated.length > 0) {
    lines.push(
      '| Package | Deprecation | Lockfile paths |',
      '| --- | --- | --- |'
    );
    for (const pkg of result.deprecated) {
      lines.push(
        `| ${escapeCell(`${pkg.name}@${pkg.version}`)} | ${escapeCell(pkg.message)} | ${escapeCell(pkg.paths.join(', '))} |`
      );
    }
    lines.push('');
  }
  const failed =
    result.errors.length > 0 || (fail && result.deprecated.length > 0);
  return { annotations, summary: `${lines.join('\n')}\n`, failed };
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const lockfiles = argv.length > 0 ? argv : ['package-lock.json'];
  const verbose = env.DEPRECATED_VERBOSE === '1' || env.RUNNER_DEBUG === '1';
  const options = {
    registryUrl:
      env.NPM_CONFIG_REGISTRY ||
      env.npm_config_registry ||
      DEFAULT_NPM_REGISTRY_URL,
    log: verbose ? (line) => console.log(`[deprecated] ${line}`) : () => {},
  };
  const fail = env.DEPRECATED_FAIL === 'true';
  let failed = false;
  for (const lockfile of lockfiles) {
    let result;
    try {
      const packages = collectPackages(
        JSON.parse(readFileSync(lockfile, 'utf8'))
      );
      result = await checkPackages(packages, options);
    } catch (error) {
      result = { checked: 0, deprecated: [], errors: [error.message] };
    }
    const rendered = render(lockfile, result, { fail });
    for (const line of rendered.annotations) {
      console.log(line);
    }
    console.log(
      `${lockfile}: ${result.checked} checked, ${result.deprecated.length} deprecated, ${result.errors.length} unanswered`
    );
    if (env.GITHUB_STEP_SUMMARY) {
      appendFileSync(env.GITHUB_STEP_SUMMARY, rendered.summary);
    }
    failed ||= rendered.failed;
  }
  return failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  process.exitCode = await main();
}
