#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const scheduleUrl =
  'https://raw.githubusercontent.com/nodejs/Release/main/schedule.json';
const releasesUrl = 'https://nodejs.org/dist/index.json';
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const versionPattern = /^v(\d+)\.\d+\.\d+$/;

// Keep the measured per-runtime shard counts when adding another Node line.
const shards = {
  'ubuntu-24.04': { node: 1, bun: 2, deno: 1 },
  'windows-2025': { node: 1, bun: 3, deno: 3 },
  'macos-26-intel': { node: 3, bun: 6, deno: 6 },
};

function latestLtsByMajor(releases) {
  if (!Array.isArray(releases) || releases.length === 0) {
    throw new Error('Expected a nonempty Node.js release index');
  }

  const ltsReleases = new Map();
  for (const release of releases) {
    const match = versionPattern.exec(release?.version);
    if (!match || typeof release.lts !== 'string' || !release.lts.trim()) {
      continue;
    }
    const major = `v${match[1]}`;
    const version = release.version.slice(1);
    const previous = ltsReleases.get(major);
    if (
      !previous ||
      version.localeCompare(previous, 'en', { numeric: true }) > 0
    ) {
      ltsReleases.set(major, version);
    }
  }
  return ltsReleases;
}

export function selectLtsVersions(schedule, releases, today) {
  if (!schedule || Array.isArray(schedule) || typeof schedule !== 'object') {
    throw new Error('Expected the Node.js release schedule object');
  }

  const ltsReleases = latestLtsByMajor(releases);
  const versions = [];
  for (const [major, { lts, end }] of Object.entries(schedule)) {
    if (lts === undefined) {
      continue;
    }
    if (
      !/^v\d+$/.test(major) ||
      !datePattern.test(lts) ||
      !datePattern.test(end) ||
      lts >= end
    ) {
      throw new Error(`Invalid Node.js LTS dates for ${major}`);
    }
    if (today < lts || today >= end) {
      continue;
    }
    const version = ltsReleases.get(major);
    // On promotion day, wait for the first binary to appear in the index.
    if (version) {
      versions.push(version);
    } else if (today !== lts) {
      throw new Error(`No published LTS release found for Node.js ${major}`);
    }
  }
  if (!versions.length) {
    throw new Error('No supported Node.js LTS releases found');
  }
  return versions.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

export function createTestMatrix(versions, { nodeOnly = false } = {}) {
  const include = [];
  for (const [os, runtimes] of Object.entries(shards)) {
    for (const [runtime, count] of Object.entries(runtimes)) {
      const nodeVersions = runtime === 'node' ? versions : nodeOnly ? [] : [''];
      for (const node of nodeVersions) {
        for (let index = 1; index <= count; index++) {
          include.push({ os, runtime, shard: `${index}/${count}`, node });
        }
      }
    }
  }
  return { include };
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`Could not read ${url} (HTTP ${response.status})`);
  }
  return response.json();
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [schedule, releases] = await Promise.all([
    fetchJson(scheduleUrl),
    fetchJson(releasesUrl),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const versions = selectLtsVersions(schedule, releases, today);
  const matrix = createTestMatrix(versions, {
    nodeOnly: process.env.GITHUB_EVENT_NAME === 'schedule',
  });
  console.log(`Supported Node.js LTS releases: ${versions.join(', ')}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `matrix=${JSON.stringify(matrix)}\n`
    );
  }
}
