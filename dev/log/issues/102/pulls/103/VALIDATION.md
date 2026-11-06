# Reproduction and verification

PR: https://github.com/link-foundation/sensitive-data-sanitizer/pull/103
Implementation commit under verification: `f52f39156884a6d10882e28c9b898a1b21b417a3` (2026-11-06 UTC). All five workflows pass for this implementation snapshot: 61 successful checks and 10 event-specific skips. Evidence publication will receive its own CI run; live PR checks and the final verification comment are authoritative for that head.

## Baseline reproductions

| Reproduction | Before evidence | Fix / automated regression |
| --- | --- | --- |
| Run the main Checks workflow after PR 99 | `ci-logs/main-checks-42126973218.log:629`, `:632`, `:635`: Prettier rejects loop spacing in three source files | Reformat affected statements; full CI Lint and Format Check plus parser/byte tests |
| Run the main Workflows policy check after PR 98 | `ci-logs/main-workflows-42126958050.log:1013`: outdated supported zizmor Action/CLI map | Current verified support map; `tests/ci-workflow-policy.test.js`, `tests/workflows-lint.test.js` |
| Run the older PR 98 runtime matrix | `ci-logs/dependabot-runtime-42098741523.log`: assertions require cache v5 / old zizmor despite upgraded Actions | Behavioral cache assertion and current support pair; `tests/pipeline-requirements.test.js` |
| Fresh app npm install on the baseline lock | `ci-logs/main-example-42126973269.log:2121`: Invalid rimraf version metadata | Fresh local-package metadata in lock, latest npm, `tests/temp-cleanup.test.js` tests real cleanup and lock metadata |
| Run formatter fixture on Windows with npm 12 | First updated CI logs `checks-e0b1b21-windows-{node,bun,deno}.log` | Upstream cmd-shim replaces handwritten wrapper; `tests/changeset-config.test.js` runs the real formatter |
| Prepare frozen Deno after adding cmd-shim | `ci-logs/checks-54eebd8-macos-deno.log`; root `^9.0.2` specifier missing | Regenerate full Deno lock; unchanged frozen-mode CI and lock-coverage guard |
| Check upgraded benchmark scanner metadata against old bridge | `verification/benchmark-pin-before.log` | Derive installed scanner expectations from requirements; `tests/python/test_benchmark_versions.py` |
| Load actual spaCy model on Python 3.15 with Presidio's required preshed 3.0.13 | `ci-logs/security-91c7c80-python.log:395–455`: OverflowError in Tokenizer._flush_specials; `experiments/issue-102/spacy-load.py` is minimal reproduction | Use compatible Python 3.14.10; retain full hash-locked install and real offline scanner smoke in Security CI. Successful job `ci-logs/security-f52f391-python.log:333–367` loads model, checks all three scanner keys and exact detected email span |

The original failures are reproducible without reverting any merged package update. The minimal tests cover actual behavior; policy tests validate the dependency integration and preserve existing status gates rather than skipping a failing check.

## Focused checks and build evidence

Use Node/npm versions from `.nvmrc` and `package.json`; use `.python-version` and the pinned uv/pip-audit versions for the Python dependency graph. Large NLP installs and the complete OS/runtime matrix run on existing GitHub-hosted CI, respecting the local 2.92 GiB limit.

```sh
node --test tests/node-toolchain.test.js tests/setup-npm.test.js
node --test tests/changeset-config.test.js tests/temp-cleanup.test.js
node --test tests/setup-buildx-resilient.test.js
python -m unittest discover -s tests/python
npm run lint
npm run format:check
npm run example:web:build
node --pending-deprecation --throw-deprecation scripts/check-desktop-compat.mjs
python scripts/audit-python-dependencies.py
```

| Check | Result / captured evidence |
| --- | --- |
| Initial baseline focused regressions | Failed as expected; `verification/baseline-regressions.log`; corrected `fixed-workflow-regressions.log`: 38 passing |
| Dependency/policy focused suite | 85 passing; `dependency-focused-tests.log` |
| Final security/temp focused suite | 24 passing; `final-focused-tests.log` |
| Actual formatter fixture / cmd-shim | 4 passing; `changeset-cmd-shim.log` |
| Node/npm toolchain integration | 22 passing; `toolchain-retest.log`; npm bootstrap 7 passing in `npm-bootstrap-tests.log` |
| Final Buildx action contract | 3 passing; `buildx-pinned-tests.log`; actual upstream Action plus daemon recovery/exhaustion both pass in CI |
| Python regression tests | 7 passing; `python314-tests.log` |
| Full ESLint and Prettier | Pass; `eslint.log`, `prettier.log` / `format-final.log`; current CI Lint and Format Check passes |
| Ruff lint / format | Pass; `python314-ruff.log`, `ruff-final.log`, `research-ruff.log` |
| Actionlint, ShellCheck, zizmor | Pass; `actionlint-final.log`, `buildx-actionlint-shellcheck.log`, `zizmor-final.log`; actual current Workflows CI passes |
| Fresh npm installs | Pass for root, app and artifact transport; `root-fresh-ci.log`, `app-fresh-ci.log`, `artifact-fresh-ci.log`; CI installs from committed locks |
| Deno graph | Frozen prepare/coverage retained; `deno-final-cache.log`, `deno-cmd-shim-lock.log`; full CI runtime results below |
| Vite web production build | Pass; `app-build.log`; current CI web build passes |
| Artifact SDK archive roundtrip | Pass with deprecations fatal; binary, empty and nested files preserved; `artifact-archive.log` |
| Electron consumer API compatibility | Pass with deprecations fatal; ASAR packed/unpacked bytes and temp cleanup preserved; `desktop-compat.log` |

The initial local full Node suite in `node-full-tests.log` was a draft run with four failures, subsequently fixed with native Windows shims, the npm tool PATH and frozen-lock updates. It is not labeled a successful final full suite. The full CI matrix supplies final integration coverage after these fixes. The completed Ubuntu Node job reports 2,944 tests: 2,943 passing, zero failures and one existing conditional skip for Bun discovery when Bun is not installed in the Node job; Bun CI exercises that discovery (`ci-logs/checks-f52f391-ubuntu-node.log:3882–3887`). No runtime deprecation warnings or npm deprecated-package warnings appear in that job or the successful Linux desktop job captured here.

## Security audits

- Root npm lock: zero findings, `verification/npm-audit-root-final.json`.
- Example npm lock: zero findings, `verification/npm-audit-app-final.json`.
- Artifact transport npm lock: zero findings, `verification/npm-audit-artifact-final.json`.
- Complete 69-package benchmark resolution: zero findings, `verification/python314-audit.log`; same committed graph checked in Security CI.
- Development/audit tooling environment: zero findings, `verification/python-tooling-audit.log`.
- Current Security workflow also passes Dependency Review and CodeQL for JavaScript/TypeScript, Python and Actions.

## SHA-matched CI

All runs below were created 2026-11-06T00:23:37Z for `f52f39156884a6d10882e28c9b898a1b21b417a3`.

| Workflow | Run | Current observed result |
| --- | --- | --- |
| Checks and release | https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42136480940 | Success: all 22 runtime matrix jobs plus lint, types/compilation, docs, release preflight, Docker build and existing policy gates |
| Example app | https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42136480805 | Success: web, Linux/Windows/macOS desktop packaging and actual preview screenshot generation |
| Security | https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42136480977 | Success, including real NLP model smoke and full graph audits |
| Workflows | https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42136481130 | Success, including actual upstream Buildx recovered/exhausted cases |
| Broken Link Checker | https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42136481043 | Success |

The unchanged Android/iOS jobs are optional workflow-dispatch jobs controlled by repository variables; they are skipped in pull-request runs and are not counted as successful builds here. Deployment, release publication and preview main-writer jobs keep their existing event/permission restrictions. Their safe build/browser/transport paths run on PRs.

Latest main `15f86c08069a53c65020fdb760512aac37929976` is already an ancestor of this branch (verified with `git merge-base --is-ancestor origin/main HEAD`). Main's old failed run cannot turn green from branch-only changes. The literal new-green-main-run acceptance remains unfinished until the normal PR merge and subsequent CI; no direct main write or merge was performed.
