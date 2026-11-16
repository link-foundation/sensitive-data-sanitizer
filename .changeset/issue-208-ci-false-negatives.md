---
'@link-foundation/sensitive-data-sanitizer': patch
---

Use secretlint 14, which builds the recommended rules into `@secretlint/core`, so the deprecated `@secretlint/secretlint-rule-preset-recommend` package is no longer installed and secret detection uses `@secretlint/core/builtin`. Harden CI against false results:

- Give every networked install a step budget and count composite actions and quoted wrapper paths in the job budgets.
- Install the reviewed npm into the Node installation, so nested npm scripts on Windows use it too.
- Run the lockfile-pinned secretlint after `npm ci`.
- Check locked npm packages for deprecations on the live registry.
- Fail the CodeQL gate on tool warnings and errors, and escape SARIF text in logs.
