#!/usr/bin/env bash
# install-reviewed-npm.sh
#
# Replace the npm bundled with setup-node's Node release by the reviewed npm
# release, everywhere a CI step can reach npm from.
#
# `npm install --global npm@X` alone is not enough on Windows runners. Their
# image configures a global prefix (C:\npm\prefix) away from the Node
# directory, so the install lands there and the Node directory keeps its
# bundled npm. The npm shims next to node.exe pick the copy under the
# *configured* prefix, and a script started by `npm --prefix DIR run ...`
# exports npm_config_prefix=DIR to its children. A nested `npm` therefore
# finds no npm under DIR and falls back to the bundled release (issue #208:
# npm 11.20.0 printed `Unknown env config "global-ignore-file"` for a config
# npm 12 exports, and skipped npm 12's install-script policy).
#
# Installing into the Node directory first covers both cases in one
# install: the shims fall back to it when the configured prefix holds no npm.
# Only when the top-level npm still differs (the configured prefix carries an
# npm of its own) does a second install target the configured prefix.
#
# Usage:
#   bash scripts/install-reviewed-npm.sh VERSION
#
# Environment:
#   INSTALL_NPM_VERBOSE   trace each decision (default: RUNNER_DEBUG, else 0)
#   INSTALL_NPM_NODE_DIR  directory holding node and its npm (default: the
#                         directory of the `node` on PATH)
#   INSTALL_NPM_FETCH_TIMEOUT_MS
#                         per-request registry timeout (default 10000)
#
# npm waits 300000ms on a stalled registry request before its first retry,
# far past this step's budget (60s then, 90s now). A macOS runner printed
# nothing for that whole budget on PR #209, while a parallel job finished the
# same install in 30s. Each request is therefore bounded and retried quickly:
# 4 attempts of 10s plus backoffs of 1s, 5s and 5s fail after about 52s
# (experiments/issue-208/npm-fetch-stall.mjs), under the 63s budget warning.
# A healthy install on a slow macOS Intel runner took 47s. Tracing adds npm's
# per-request http log.
#
# Every invocation verifies both the top-level and the nested npm, and is a
# no-op when both already report VERSION, so repeated composite-action calls
# within one job stay cheap.
set -euo pipefail

if [ "$#" -ne 1 ] || ! [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: $0 VERSION (an exact x.y.z npm release)" >&2
  exit 2
fi

version="$1"
verbose="${INSTALL_NPM_VERBOSE:-${RUNNER_DEBUG:-0}}"
trace() { [ "${verbose}" = "1" ] && echo "[install-npm] $*" >&2 || true; }

install_flags=(
  --ignore-scripts --no-audit --no-fund
  "--fetch-timeout=${INSTALL_NPM_FETCH_TIMEOUT_MS:-10000}"
  --fetch-retries=3 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=5000
)
if [ "${verbose}" = "1" ]; then
  install_flags+=(--loglevel=http)
fi

node_dir="${INSTALL_NPM_NODE_DIR:-$(node -p 'require("node:path").dirname(process.execPath)')}"
platform="$(node -p process.platform)"
# npm's global layout: <prefix>/node_modules on Windows, <prefix>/lib/node_modules
# elsewhere, with node itself in <prefix> or <prefix>/bin respectively.
if [ "${platform}" = win32 ]; then
  node_prefix="${node_dir}"
  node_npm_cli="${node_prefix}/node_modules/npm/bin/npm-cli.js"
else
  node_prefix="$(dirname "${node_dir}")"
  node_npm_cli="${node_prefix}/lib/node_modules/npm/bin/npm-cli.js"
fi
# Any directory without an npm install stands in for `npm --prefix DIR`.
nested_prefix="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"

top_level_version() { npm --version 2>/dev/null || echo none; }
nested_version() {
  npm_config_prefix="${nested_prefix}" npm --version 2>/dev/null || echo none
}

trace "node: ${node_dir} (${platform}); Node install prefix: ${node_prefix}"
# Each `npm --version` costs seconds on Windows runners; only spend them when
# tracing.
if [ "${verbose}" = "1" ]; then
  trace "before: top-level npm $(top_level_version), nested npm $(nested_version)"
fi

if [ "$(nested_version)" != "${version}" ]; then
  # Run the Node directory's npm by path: a shell or batch shim in the
  # directory being replaced would be rewritten while it runs.
  trace "installing into ${node_prefix} with ${node_npm_cli}"
  node "${node_npm_cli}" install --global --prefix "${node_prefix}" \
    "npm@${version}" "${install_flags[@]}"
fi

if [ "$(top_level_version)" != "${version}" ]; then
  trace "the configured global prefix holds another npm; installing there"
  npm install --global "npm@${version}" "${install_flags[@]}"
fi

top_level="$(top_level_version)"
nested="$(nested_version)"
if [ "${top_level}" != "${version}" ] || [ "${nested}" != "${version}" ]; then
  echo "::error title=Reviewed npm is not in effect::Expected npm ${version} everywhere, but the top-level npm is ${top_level} and npm under another --prefix is ${nested}."
  exit 1
fi
echo "npm ${version} is in effect for top-level and nested npm commands."
