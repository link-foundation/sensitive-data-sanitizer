#!/usr/bin/env bash
# Show that `npm ci` compiles better-sqlite3 although it sets `gypfile: false`.
#
# npm's lockfile records no `gypfile` field, so on a lockfile-driven install
# @npmcli/arborist sees `gypfile === undefined`, finds `binding.gyp` on disk
# and synthesizes `node-gyp rebuild` (lib/install-scripts.js and
# lib/arborist/rebuild.js#addToBuildSet). A lockfile-free `npm install` reads
# the package.json from the packument, sees `gypfile: false` and uses the
# shipped prebuilds.
#
# Usage: bash experiments/issue-208/gypfile-lockfile-repro.sh [allow|deny]
#   allow (default): allowScripts permits better-sqlite3, so npm ci compiles
#   deny: allowScripts denies it (the workaround), so nothing compiles
set -euo pipefail
mode="${1:-allow}"
allow=true
if [ "$mode" = deny ]; then allow=false; fi
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cd "$work"
printf '{"name":"repro","version":"1.0.0","private":true,"dependencies":{"better-sqlite3":"13.0.3"},"allowScripts":{"better-sqlite3":%s}}\n' "$allow" >package.json
echo "npm $(npm --version), node $(node --version), mode=$mode"

npm install --no-audit --no-fund >install.log 2>&1
built_install=no
if [ -d node_modules/better-sqlite3/build ]; then built_install=yes; fi
echo "npm install (no lockfile): compiled=$built_install"

rm -rf node_modules
npm ci --no-audit --no-fund >ci.log 2>&1
built_ci=no
if [ -d node_modules/better-sqlite3/build ]; then built_ci=yes; fi
echo "npm ci (from lockfile):    compiled=$built_ci"
grep -h 'install-scripts' ci.log || true
node -e "const D=require('$work/node_modules/better-sqlite3');console.log('sqlite', new D(':memory:').prepare('select sqlite_version() v').get().v)"
