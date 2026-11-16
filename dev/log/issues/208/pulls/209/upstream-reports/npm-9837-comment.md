I confirmed the lead in the comment above at the source level (npm 12.2.2, `@npmcli/arborist` 10.0.4; same behaviour with npm 11.20.0). It comes from the lockfile:

1. `gypfile` is not in `pkgMetaKeys` in `lib/shrinkwrap.js`, so `package-lock.json` never records it. On a lockfile-driven install (`npm ci`, or `npm install` with an existing lock), `node.package` comes from the lock entry and `gypfile` is `undefined`.
2. `lib/arborist/rebuild.js` `#addToBuildSet` reads `package.json` from disk only when the lock says `hasInstallScript` (or for old lockfiles). better-sqlite3 has no install script, so it goes straight to
   ```js
   const isGyp = gypfile !== false && !install && !preinstall && await isNodeGypPackage(node.path)
   ```
   `undefined !== false` is true, `binding.gyp` is on disk, so `scripts.install = defaultGypInstallScript` (`node-gyp rebuild`).
3. `lib/install-scripts.js` has the same check (`pkg.gypfile !== false && await isNodeGypPackage(node.path)`, then `collected.install = 'node-gyp rebuild'`). That is the source of the `install-scripts blocked (install: node-gyp rebuild)` warning in the original report.

A lockfile-free `npm install` builds the node from the packument manifest, which has `gypfile: false`, so neither path fires.

### Repro

```bash
set -euo pipefail
work="$(mktemp -d)"; cd "$work"
echo '{"name":"repro","version":"1.0.0","private":true,"dependencies":{"better-sqlite3":"13.0.3"},"allowScripts":{"better-sqlite3":true}}' > package.json
npm install --no-audit --no-fund >/dev/null 2>&1
[ -d node_modules/better-sqlite3/build ] && echo "install: compiled" || echo "install: prebuild only"
rm -rf node_modules
npm ci --no-audit --no-fund >/dev/null 2>&1
[ -d node_modules/better-sqlite3/build ] && echo "ci: compiled" || echo "ci: prebuild only"
```

Output with npm 12.2.2 and Node 26.13.0 on Linux x64:

```
install: prebuild only
ci: compiled
```

With `"allowScripts": {"better-sqlite3": false}`, both print `prebuild only` and the module still loads (`select sqlite_version()` returns 3.53.4). Without an `allowScripts` entry, npm 12 blocks the synthesized script and prints the warning from the original report, but only for `npm ci`.

### Workaround

`"allowScripts": {"better-sqlite3": false}` in the root `package.json`, on npm versions that support `allowScripts` (confirmed on 11.19.1 above, and on 12.2.2 here). On npm without `allowScripts`, the only workaround is `--ignore-scripts`.

### Possible fixes

- Add `gypfile` to `pkgMetaKeys`, recorded only when it is `false`, so the lockfile keeps the opt-out (`metaFieldFromPkg` already copies selected keys). Existing lockfiles still lack it, so this needs the next item as well, or a lockfile refresh.
- In `#addToBuildSet` and `install-scripts.js`, before synthesizing `node-gyp rebuild` for a node whose `package` came from the lockfile (`gypfile === undefined`), read `package.json` from `node.path` (the existing `PackageJson.normalize(node.path)` call) and honour `gypfile: false`. This only runs for packages that ship a `binding.gyp`, so the extra read is cheap.
