Additional current-version case: setup-node v7.1.0 with Node 26.13.0 (bundled npm 11.20.0) and a repository declaring:
```json
{"devEngines":{"packageManager":{"name":"npm","version":">=12.2.2","onFail":"error"}}}
```
Enabling npm caching asks the bundled npm for its cache directory before the workflow can install npm 12.2.2. npm correctly rejects the repository's devEngines mismatch, so setup fails before the explicit upgrade step. Updating Node alone does not solve projects whose reviewed npm release is newer than Node's bundled npm.

Our small composite runs setup-node with `package-manager-cache: false`, installs the exact reviewed npm version, then invokes setup-node again with npm caching enabled. It preserves strict devEngines and delegates cache-key/cache-path behavior to setup-node: https://github.com/link-foundation/sensitive-data-sanitizer/pull/103 .

A package-manager-version input, or an explicit opt-in to bootstrap the manifest's package manager before cache discovery, would let us delete the second invocation and local wrapper. Avoiding cache discovery when caching is disabled remains necessary as the first-stage escape hatch. This is a current v7 reproduction of the existing issue, not a request to loosen devEngines validation.
