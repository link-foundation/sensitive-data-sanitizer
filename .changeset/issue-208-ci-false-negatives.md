---
'@link-foundation/sensitive-data-sanitizer': patch
---

Use secretlint 14, which builds the recommended rules into `@secretlint/core`, so the deprecated `@secretlint/secretlint-rule-preset-recommend` package is no longer installed and secret detection uses `@secretlint/core/builtin`. Harden CI against false results:

- Give every networked install a step budget and count composite actions and quoted wrapper paths in the job budgets.
- Install the reviewed npm into the Node installation, so nested npm scripts on Windows use it too, with one install where the runner allows it.
- Run the lockfile-pinned secretlint after `npm ci`, and scan compressed and git-ignored tracked evidence for secrets.
- Check locked npm packages for deprecations on the live registry.
- Fail the CodeQL gate on tool warnings and errors, escape SARIF text in logs, and name the file and line of each finding.
- Install a pinned, checksum-verified lychee, fail on missing or empty link reports, parse only the lychee Errors section one record per line, and save the link cache only from `main`.
- Run JavaScript checks when only `examples/` or `experiments/` change, apply the line limit to shell scripts and Git hooks, run ShellCheck from a private venv, and keep the zizmor self-repository exception equal to its users.
- Fail `prepare` when Husky reports an error.
- Start budget annotations on a new line after unterminated command output.
- Report lint warnings anywhere in a changed file, and every warning when the lint configuration changes.
- Assert the shape of action pins in tests, so Dependabot bumps keep them green.
- Split the Ubuntu Bun test suite into two shards, and fail the lychee download fixtures only where a test needs the retry.
- Explain the expected error annotations of the simulated Buildx registry outage with a notice.
- Bound and retry each registry request of the reviewed npm install, with an http log under tracing.
- Measure the issue-32 document-guard probe as growth on the same machine after warm-up, instead of an absolute CPU limit.
- Fail the secrets scan on zip, plain tar and other unsupported archives nested in gzip evidence.
- Fit the lychee, preview GitHub CLI and reviewed npm download retries inside their step budgets.
- Keep budget annotations on their own line when the command writes during relaying, and detect local actions written with extra spaces.
