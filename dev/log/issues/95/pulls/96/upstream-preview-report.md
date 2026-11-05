The preview screenshot writer calls `gh auth setup-git` inside the official
Playwright image, which does not install GitHub CLI. PRs skip the writer, so
their green checks do not exercise this environment. The same workflow code is
present at template commit `7877a27980664bc6453e80262f8391d1c2562ab1`.

Observed downstream: [sensitive-data-sanitizer run 42080626844](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42080626844),
2026-11-05 18:04:50 UTC: screenshots regenerate successfully; the commit step
exits 127 with `gh: command not found`; the terminal gate correctly fails.
Full evidence and the downstream fix are in
[PR 96](https://github.com/link-foundation/sensitive-data-sanitizer/pull/96).

Reproduce without credentials or writes:

```sh
docker run --rm --entrypoint bash \
  mcr.microsoft.com/playwright@sha256:b0ab6f3cb99aa7803adbc14d9027ec1785fc6e433b97e134e0f8fe61683b6b53 \
  -c 'command -v git; command -v node; gh --version'
```

Expected: every tool required by `preview-regen` is available. Actual: `gh` is
missing. A GitHub-hosted runner's installed tools are not inherited by its job
container. The [official Dockerfile](https://github.com/microsoft/playwright/blob/v1.59.1/utils/docker/Dockerfile.noble)
installs Node and browser dependencies, not GitHub CLI.

Workaround: install a reviewed official GitHub CLI Linux archive inside the
container before the first `gh` call. Verify a hard-coded SHA256 before
extracting, and append its directory to `$GITHUB_PATH`. For example,
`gh_2.103.3_linux_amd64.tar.gz` has SHA256
`4c806978ffce1cec70853302a56d70ac6da4f19bae7adca4e1a8ab00633dd91d`
in the [official release](https://github.com/cli/cli/releases/tag/v2.103.3).
Using an unpinned package manager install in a write-permission job would lose
the workflow's existing dependency review guarantees.

Suggested code changes:

1. Extract a pinned, checksum-verified CLI installer into `scripts/` and run it
   before `gh auth setup-git` in the writer.
2. Add a read-only PR job using the **same Playwright image**. Install the CLI,
   check all required executables, and exercise `gh auth setup-git` followed by
   `git credential fill` against temporary configuration and a dummy token.
   This needs no live credentials, GitHub API calls, or repository writes.
3. Include the smoke job in the terminal status gate and make the writer depend
   on it. Keep the existing main-only publication condition and writer queue.
4. Include the installer, checker, and transitive writer helpers in both workflow
   path filters so helper-only changes cannot skip this check.
5. Cover missing `gh`, checksum rejection, workflow dependency wiring, and the
   real container smoke job in regression tests. Keep opt-in tool-location
   diagnostics off by default.

The defect belongs in the workflow setup; Playwright does not promise to ship
GitHub CLI, so no Playwright change is needed.
