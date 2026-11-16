## Summary

`tests/deprecated-packages.test.js` reads the `deprecated` field from committed `package-lock.json` files. npm writes that field only when it **resolves** a package, so a version that is deprecated *after* the lockfile was written stays invisible until somebody regenerates the lockfile. The check passes while CI installs a deprecated package (false negative).

## Evidence

The Python template's committed `.github/actions/artifact/package-lock.json` (head `c532c17`) locks `@secretlint/secretlint-rule-preset-recommend@13.1.0` with no `deprecated` field, but the registry deprecates that version today:

```
$ curl -s https://registry.npmjs.org/@secretlint%2fsecretlint-rule-preset-recommend/13.1.0 | jq -r .deprecated
Built into secretlint v14 and later. Remove this package; the rule id still works. https://github.com/secretlint/secretlint/blob/HEAD/docs/rules/preset-recommend.md
```

A lockfile-only test, like this template's, therefore reports that lockfile as clean. This template's three lockfiles are clean on the live registry today (846 locked versions checked), so this is a latent gap here, which the next upstream deprecation would expose.

## Reproduction

1. Take any lockfile and delete the `"deprecated": ...` line of one entry (or lock a version that was deprecated after locking, as above).
2. `node --test tests/deprecated-packages.test.js` passes.

## Workaround

Run `npm install --package-lock-only` periodically (Dependabot does this when it bumps something) so npm refreshes `deprecated`.

## Suggested fix

Add a live check that asks the registry for each locked `name@version` document (a few KiB each, run 8 at a time) and reads its current `deprecated`. Run it in the security workflow: warn on pull requests and fail on the weekly schedule, so a fresh deprecation turns the scheduled run red without blocking unrelated PRs. A registry error must fail and never be reported as clean. Implemented downstream as `scripts/check-deprecated-packages.mjs` with tests in link-foundation/sensitive-data-sanitizer#209. Its core is:

```js
const url = `${registry}/${name.replace('/', '%2f')}/${version}`;
const manifest = await (await fetch(url, { signal: AbortSignal.timeout(15000) })).json();
if (manifest.version !== version) throw new Error(`${name}@${version}: registry returned another version`);
const message = typeof manifest.deprecated === 'string' ? manifest.deprecated : '';
```

```yaml
# downstream this sits in an npm-audit job with one matrix leg per lockfile directory
- name: Check live deprecations
  working-directory: ${{ matrix.directory }}
  env:
    DEPRECATED_FAIL: ${{ github.event_name == 'schedule' && 'true' || 'false' }}
  run: bash "$GITHUB_WORKSPACE/scripts/run-with-budget-warning.sh" 120 "Live deprecation check" node "$GITHUB_WORKSPACE/scripts/check-deprecated-packages.mjs" package-lock.json
```
