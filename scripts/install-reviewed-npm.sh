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
# Usage:
#   bash scripts/install-reviewed-npm.sh VERSION
#
# Environment:
#   INSTALL_NPM_VERBOSE  trace each decision (default: RUNNER_DEBUG, else 0)
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

node_dir="$(node -p 'require("node:path").dirname(process.execPath)')"
platform="$(node -p process.platform)"
# npm's global layout: <prefix>/node_modules on Windows, <prefix>/lib/node_modules
# elsewhere, with node itself in <prefix> or <prefix>/bin respectively.
if [ "${platform}" = win32 ]; then
  node_prefix="${node_dir}"
else
  node_prefix="$(dirname "${node_dir}")"
fi
# Any directory without an npm install stands in for `npm --prefix DIR`.
nested_prefix="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"

top_level_version() { npm --version 2>/dev/null || echo none; }
nested_version() {
  npm_config_prefix="${nested_prefix}" npm --version 2>/dev/null || echo none
}

trace "node: ${node_dir} (${platform}); Node install prefix: ${node_prefix}"
trace "before: top-level npm $(top_level_version), nested npm $(nested_version)"

if [ "$(top_level_version)" != "${version}" ]; then
  npm install --global "npm@${version}" --ignore-scripts --no-audit --no-fund
fi

if [ "$(nested_version)" != "${version}" ]; then
  # Run the reviewed npm by path rather than through a shim in the directory
  # being replaced.
  global_prefix="$(npm prefix --global)"
  if [ "${platform}" = win32 ]; then
    reviewed_cli="${global_prefix}/node_modules/npm/bin/npm-cli.js"
  else
    reviewed_cli="${global_prefix}/lib/node_modules/npm/bin/npm-cli.js"
  fi
  trace "nested npm differs; installing into ${node_prefix} with ${reviewed_cli}"
  node "${reviewed_cli}" install --global --prefix "${node_prefix}" \
    "npm@${version}" --ignore-scripts --no-audit --no-fund
fi

top_level="$(top_level_version)"
nested="$(nested_version)"
if [ "${top_level}" != "${version}" ] || [ "${nested}" != "${version}" ]; then
  echo "::error title=Reviewed npm is not in effect::Expected npm ${version} everywhere, but the top-level npm is ${top_level} and npm under another --prefix is ${nested}."
  exit 1
fi
echo "npm ${version} is in effect for top-level and nested npm commands."
