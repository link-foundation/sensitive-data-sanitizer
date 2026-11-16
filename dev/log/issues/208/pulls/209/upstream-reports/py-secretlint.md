## Summary

The secrets scan installs a **deprecated** package, and the deprecation checks cannot see it:

- `.github/actions/artifact/package.json` pins `secretlint` 13.1.0 and `@secretlint/secretlint-rule-preset-recommend` 13.1.0. The registry now marks the preset as deprecated: *"Built into secretlint v14 and later. Remove this package; the rule id still works."*
- The committed `.github/actions/artifact/package-lock.json` (head `c532c17`) locks the preset 13.1.0 **without** a `deprecated` field. npm writes that field only when it resolves a package, and the deprecation came after the lockfile was written. So a check that reads `deprecated` from the lockfile reports this lockfile as clean (false negative), and `npm ci` prints the `npm warn deprecated` line in the "Check for secrets" step on every run.

## Evidence

```
$ curl -s https://registry.npmjs.org/@secretlint%2fsecretlint-rule-preset-recommend/13.1.0 | jq -r .deprecated
Built into secretlint v14 and later. Remove this package; the rule id still works. https://github.com/secretlint/secretlint/blob/HEAD/docs/rules/preset-recommend.md
```

A live registry check of every locked version (`node scripts/check-deprecated-packages.mjs .github/actions/artifact/package-lock.json`, from link-foundation/sensitive-data-sanitizer#209):

```
::warning file=.github/actions/artifact/package-lock.json,title=deprecated packages::@secretlint/secretlint-rule-preset-recommend@13.1.0 is deprecated: Built into secretlint v14 and later. Remove this package; the rule id still works. ...
.github/actions/artifact/package-lock.json: 298 checked, 1 deprecated, 0 unanswered
```

## Reproduction

```sh
npm ci --prefix .github/actions/artifact --ignore-scripts --no-audit --no-fund 2>&1 | grep 'warn deprecated'
grep -A8 '"node_modules/@secretlint/secretlint-rule-preset-recommend"' .github/actions/artifact/package-lock.json | grep -c deprecated   # 0
```

## Workaround

None that keeps 13.x: the preset is deprecated for every version.

## Suggested fix

1. Upgrade to secretlint 14 (engines `node >=22`), which builds the recommended rules into `@secretlint/core`. Remove `@secretlint/secretlint-rule-preset-recommend` from `devDependencies`, then run `npm install --prefix .github/actions/artifact`. The existing `.secretlintrc.json` rule id `@secretlint/secretlint-rule-preset-recommend` keeps working, as the deprecation message says. Downstream, the same change scans the repository with no findings (link-foundation/sensitive-data-sanitizer#209).
2. Add a check that reads deprecations from the live registry, so the next deprecation is caught before a lockfile refresh. Fetch `<registry>/<name>/<version>` for every locked registry package and read its `deprecated` field. Warn on pull requests, fail on the weekly schedule, and fail on any unanswered request. See `scripts/check-deprecated-packages.mjs` in the PR above, and the JS template issue filed alongside this one.
