# Template delta review (issue 208)

Target: `/tmp/gh-issue-solver-1794814194933` (link-foundation/sensitive-data-sanitizer, npm package).
Baseline: PR #96 review (`dev/log/issues/95/pulls/96/TEMPLATE-REVIEW.md`, JS template 7877a27, Python template 78f2fdf).
Template clones read (not executed): `/tmp/probe-208/templates/js`, `/tmp/probe-208/templates/python`.
PR diffs: `/tmp/probe-208/diffs/{js,py}-<n>.{body.md,diff,f.diff}`.

Legend: **(a)** already present, **(b)** missing and applicable, **(c)** not applicable.
Local paths are relative to the target repository. "T-js" is `/tmp/probe-208/templates/js`, "T-py" is `/tmp/probe-208/templates/python`.

Totals: 13 distinct (b) gaps across 18 (b) rows (some gaps appear in both JS and Python PRs), 25 (a) rows, 18 (c) rows.

---

## JS #288

| item | template evidence | local evidence | disposition |
|---|---|---|---|
| minimatch/glob security overrides | T-js `package.json` overrides | `package.json:174`, `.github/actions/artifact-transport/package.json:13,18`, `examples/universal-app/package.json:77-78` | (a) |
| `yaml` devDependency for workflow tests | T-js `package.json` | `package.json:168` | (a) |
| preview-tools job + `check-preview-tools.sh`, `setup-preview-gh.sh`, archive tests | T-js `example-app.yml` | `.github/workflows/example-app.yml:17-18,310-332`; the scripts and `tests/archive-and-discovery.test.js` are byte-identical to the template | (a) |
| lint/line-limit run on `workflow_dispatch` with `!cancelled()` | T-js `release.yml` | `.github/workflows/release.yml:101-102,124-126` | (a) |
| Scorecard is informational | T-js `security.yml` | `.github/workflows/security.yml:124-125` | (a) |
| Push retries re-attest `releaseParent`; release fallback throws | T-js `push-main-with-rebase-retry.mjs` | `scripts/push-main-with-rebase-retry.mjs:109-117,138-143` | (a) |
| Rule-aware transient classifier (GH006/GH013 first) | T-js `push-failure-classifier.mjs` | `scripts/push-failure-classifier.mjs:95-103` | (a) |
| Remote advance attested via `assertValidatedRelease` | T-js `version-and-commit.mjs` | `scripts/version-and-commit.mjs:186-215` | (a) |
| Metadata-only commit (`git add -A` + `assertReleaseMetadataOnly` fail-closed) | T-js `release-metadata.mjs` | `scripts/version-and-commit.mjs:258`, `scripts/release-metadata.mjs` | (a) |
| `assertMetadataDiff` | T-js `release-metadata.mjs` | `scripts/release-metadata.mjs` (present) | (a) |
| Published SHA is an ancestor of `origin/main` | T-js `release-publication.mjs` | `scripts/release-publication.mjs:45-55` | (a) |
| **CodeQL invocation notifications gate** (`toolExecutionNotifications` / `toolConfigurationNotifications` of level warning/error, or missing message, fail the run) | T-js `scripts/check-codeql-results.mjs:23-77` (`describeNotification`, `validNotification`, `invocationDiagnostics`), called from `checkRun` (~:79); T-py `scripts/check_codeql_results.py:81` | `scripts/check-codeql-results.mjs:17-36` only checks `executionSuccessful` (grep for `Notifications` finds nothing) | **(b)** |
| **lychee parser: adjacent records and section restriction** | T-js `scripts/recheck-broken-links.mjs:71-77` (`[ \t]` in place of `\s`, parse only the Errors section); T-js `scripts/lychee-report.mjs:26` `extractErrorsSection` with strict fallback; tests in `js-288.f.diff:1719-1755` | `scripts/recheck-broken-links.mjs` `parseLycheeFailures` uses `\s` (spans newlines) over the whole report; `scripts/check-web-archive.mjs:64-71` falls back to the whole content. Experiment (`/tmp/probe-208/work/t.mjs`): two adjacent detail-less entries merge into one record, and Redirects entries are counted as failures | **(b)** |
| **Self-repository (`uses: ./`) exception policy** | T-js `scripts/check-ci-workflows.mjs:75-103` `checkSelfRepositoryPolicy`, main reads `.github/zizmor.yml` at :113-135 | `scripts/check-ci-workflows.mjs` (92 lines) has no such check. `.github/zizmor.yml:25-33` currently matches the real `./` users exactly | **(b, low)** |
| npm audit `validateAdvisory`/`reachesAdvisory` (reference-only cycles) | T-js `scripts/npm-audit-report.mjs:69-123` | `scripts/npm-audit-report.mjs:58-90,129-131,248-256` already handle realistic `via` chains. npm does not emit reference-only cycles | (c) theoretical |
| `git diff --exit-code HEAD` before publish + `validateVersionTree` | T-js `release-publication.mjs:50`, `version-lock.mjs:25` | No step between versioning and publish dirties the tree. The release job runs merge changesets, then `version-and-commit` (which commits everything, `scripts/version-and-commit.mjs:258-264`), then publish. There is no build or prepack script, and the only lifecycle script is `prepare` (hooks). `captureVersionTree` (`scripts/version-lock.mjs:19-38`) already validates the lock | (c) |

**Port notes (b):**
- *CodeQL notifications.* Copy `describeNotification`, `validNotification` and `invocationDiagnostics` from T-js `scripts/check-codeql-results.mjs:23-77` into `scripts/check-codeql-results.mjs`. Call them for every `run.invocations[]` beside the existing `executionSuccessful` check, and add the template tests. Safety check against the latest main SARIF (Security run 43782250481, `/tmp/probe-208/work/codeql/`): javascript has 853 notifications, actions 438, and python 453 (448 `none` and 5 `note`), with no `warning` or `error` and none missing a message. The new gate therefore passes today.
- *lychee parser.* In `scripts/recheck-broken-links.mjs`, replace the record regex with the template form from T-js `recheck-broken-links.mjs:71-77`, which uses `[ \t]` and does not cross lines, and run it only over the Errors section. Add the shared `extractErrorsSection` from T-js `scripts/lychee-report.mjs:26`, whose fallback returns `''` unless the report has no sections at all. Make `scripts/check-web-archive.mjs:64-71` import that function instead of keeping its own copy. Port the "adjacent lychee records" and "section-only report" tests (`js-288.f.diff:1719-1755`). The risk this fixes: a detail-less transient record followed by a 404 merges into one record, so `allFailuresRecovered` can hide the 404.
- *Self-repository policy.* Port `checkSelfRepositoryPolicy` from T-js `scripts/check-ci-workflows.mjs:75-103,113-135`. It fails when `.github/zizmor.yml` lists a file with no `uses: ./`, or when a `./` user is not listed. The risk is only future drift, because the list is accurate today.

## JS #293

| item | template evidence | local evidence | disposition |
|---|---|---|---|
| Check workflows use `cancel-in-progress: true`; writers use `false` + queue | T-js workflows | `.github/workflows/release.yml:606,767,856,962,1041`, `.github/workflows/example-app.yml:152,360` | (a) |
| `check-pipeline-status.sh` treats superseded runs correctly | T-js `scripts/check-pipeline-status.sh` | `scripts/check-pipeline-status.sh` byte-identical | (a) |
| **Husky install: fail on Husky message even if a stale `hooksPath` exists** | T-js `scripts/install-git-hooks.mjs:38` `if (message \|\| !hooksPath)` | `scripts/install-git-hooks.mjs:38` `if (!hooksPath)`. A Husky error with a leftover `core.hooksPath` reports success. Developer-only, because CI skips it via `env.CI` | **(b, low)** |
| **Pinned lychee installer + direct run with report/Total checks** | T-js `scripts/install-lychee.sh` (67 lines; retries, SHA256 verify), T-js `.github/workflows/links.yml:92-132` | `.github/workflows/links.yml:85-118` uses `lycheeverse/lychee-action@v2.9.0`. Its download has no retry or checksum, a stale or missing report is not detected, and there is no "Total > 0" check (an empty scan passes) | **(b)** |

**Port notes (b):**
- *Husky.* Change `scripts/install-git-hooks.mjs:38` to `if (message || !hooksPath)`, as in T-js `:38`, and add the template test case.
- *lychee installer.* Add `scripts/install-lychee.sh` from T-js and use the #300 pins: `LYCHEE_VERSION=v0.24.2`, `LYCHEE_SHA256_X86_64=1f4e0ef7f6554a6ed33dd7ac144fb2e1bbed98598e7af973042fc5cd43951c9a`, `LYCHEE_SHA256_AARCH64=91a7bd65685da41b90ccb9bc867a3d649a7818042dae04ff405e55a25bddee4c`. Replace the action step with T-js `links.yml:92-132`: install, then `rm -f lychee/out.md`, then `lychee --mode task --format markdown --output lychee/out.md <local args>`. The step must keep the local args, including `--exclude-path dev/log`. It fails if the report is missing, if the exit code is not 0 or 2, or if Total is not positive. Add `scripts/install-lychee.sh` and its test to the `links.yml` path triggers. The Python equivalent is T-py `scripts/install-lychee.sh` and `check-links.sh` (py #143).

## JS #231

| item | template evidence | local evidence | disposition |
|---|---|---|---|
| `rust-template-applied` input / cross-template adoption tracking | T-js #231 diff | Only case-study data mentions the Rust template (`docs/case-studies/issue-40/...`). This repo does not use the multi-template adoption flow | (c) |
| javascript-first gate/example workflows + docs/adoption tests | T-js #231 diff | No javascript-first workflows exist locally (`ls .github/workflows`) | (c) |

## JS #300

| item | template evidence | local evidence | disposition |
|---|---|---|---|
| `init.defaultBranch` via `GIT_CONFIG_*` env | T-js workflows | Present in all 6 local workflows (e.g. `.github/workflows/links.yml:49-52`) | (a) |
| **shellcheck from a venv (no pipx PATH warning)** | T-js `.github/workflows/workflows.yml:88-90`; `package.json:95,98` `--no-path-check` | `.github/workflows/workflows.yml:95` `pipx run --spec shellcheck-py==0.11.0.1 shellcheck`; `package.json:148,156` lint-staged pipx calls without `--no-path-check` | **(b, low)** |
| **examples/experiments JS run syntax, lint and tests** | T-js `scripts/detect-code-changes.mjs:349-353` (`packageChangedFiles`, excluding only `docs/case-studies` and `dev/log`) | `scripts/detect-code-changes.mjs:349-351` derives `jsChanged` from `relevantChangedFiles`, which excludes `examples/` and `experiments/` (:42-48). A PR that only touches those skips test-compilation (`release.yml:100-102`), lint (`:254-260`) and tests. The `examples/*.mjs` files are shipped (`package.json` `files`); there are 21 example and 226 experiment JS files | **(b)** |
| **Secret scan covers gzip/tar evidence** | T-js `scripts/check-secrets.mjs` (220 lines; bounded gunzip of 128 MiB, tar members, fail-closed), invoked at T-js `release.yml:257` | `.github/workflows/release.yml:278` runs `secretlint "**/*"`, which cannot read compressed content. 8 tracked `docs/case-studies/issue-212/validation/*.log.gz` CI logs go unscanned. A manual secretlint run on the decompressed logs is clean today, so this is a latent gap | **(b)** |
| **Quote untrusted SARIF text in CodeQL logs** | T-js `scripts/check-codeql-results.mjs:7-11` `quote()` escapes `::` and `##[`, used at :137,156 | `scripts/check-codeql-results.mjs:70,89` print SARIF rule/message text raw. Workflow-command injection is possible from alert text | **(b, low)** |
| **Link cache saved only from main** | T-js `.github/workflows/links.yml:84-90` (`actions/cache/restore`), `:134-139` (`actions/cache/save` on push to main without an exact hit) | `.github/workflows/links.yml:78-83` `actions/cache@v6.1.0` restores and saves on PRs too, so PR runs can seed results for main | **(b, low)** |
| Docker PR build `cache-to` | T-js `release.yml` docker-build | `.github/workflows/release.yml:512`. The docker-build job is PR-only and dormant: no Dockerfile exists outside `dev/log`, and `check-docker-build.mjs` reports it disabled | (c) port only if Docker is enabled |
| E413 is not retried (`PAYLOAD_TOO_LARGE_PATTERNS`) | T-js `scripts/publish-failure-classifier.mjs` | The package has an explicit `files` list (`src` is about 1.2 MB) and no platform binaries; the worst case is a slower failure | (c) |
| `check-npm-tarball-size.mjs` 157 MiB gate | T-js `scripts/check-npm-tarball-size.mjs` | Same reason: the tarball is small and has no optionalDependencies or binaries | (c) |
| Optional platform-package docs | T-js docs | No platform packages | (c) |

**Port notes (b):**
- *shellcheck.* Mirror T-js `workflows.yml:88-90`: `python3 -m venv "$RUNNER_TEMP/shellcheck"`, `pip install shellcheck-py==0.11.0.1`, then run the venv binary. In `package.json:148,156`, add `--no-path-check` to the `pipx run` commands (T-js `package.json:95,98`).
- *examples/experiments.* Port T-js `scripts/detect-code-changes.mjs:349-353`. Compute `jsChanged` from all package changes except `docs/case-studies/` and `dev/log/`, and update `tests/` expectations for examples-only and experiments-only PRs. Check that lint and the experiments tree pass first, because lint has not been gated on those paths so far.
- *gzip secrets.* Add `scripts/check-secrets.mjs` from T-js and replace `release.yml:278` with the T-js `release.yml:257` invocation. Keep `.secretlintignore` (`dev/log/` stays excluded) and port the template tests (gz member, tar member, size bound, corrupt archive fails closed).
- *CodeQL quoting.* Add the `quote` helper from T-js `:7-11` and route the values logged at `:70,89` through it.
- *Link cache.* Split into `actions/cache/restore@v6.1.0`, which runs on every run, and `actions/cache/save@v6.1.0` with `if: github.event_name == 'push' && github.ref == 'refs/heads/main' && steps.<restore>.outputs.cache-hit != 'true'`. This follows T-js `links.yml:84-90,134-139`.

## Python #139

| item | template evidence | local evidence | disposition |
|---|---|---|---|
| Transient (`commit_refs_rules`, 429, 5xx) push retries, rules checked first | T-py release scripts | `scripts/push-failure-classifier.mjs:96-99` | (a) |
| `CI_SCRIPTS_DEBUG` push diagnostics | T-py | `scripts/push-main-with-rebase-retry.mjs:119-123` | (a) |
| Validated SHA + metadata-only child attestation | T-py | `scripts/release-metadata.mjs`, `scripts/release-publication.mjs:7-35` | (a) |
| Manifest/lock equality except version | T-py | `scripts/version-lock.mjs:8-51` | (a) |
| Re-attest after rebase | T-py | `scripts/push-main-with-rebase-retry.mjs:109-117` (inside `push()`, re-run after `pull --rebase`) | (a) |
| **CodeQL invocation notifications gate** | T-py `scripts/check_codeql_results.py:81` | Same gap as JS #288 (`scripts/check-codeql-results.mjs:17-36`) | **(b)** (same gap) |
| Dirty checkout check before publish | T-py | See JS #288: no dirty-tree producer | (c) |
| Explicit `HEAD:refs/heads/<branch>` for detached HEAD | T-py | `scripts/push-main-with-rebase-retry.mjs:104` `HEAD:${branch}`. Remote `main` always exists, so it resolves unambiguously | (c) |

## Python #143

| item | template evidence | local evidence | disposition |
|---|---|---|---|
| Check concurrency, writer queue, Pages deploy in the writer group | T-py workflows | `.github/workflows/example-app.yml:152,360`, `release.yml` writer groups | (a) |
| Example-app concurrency split | T-py `example-app.yml` | Same lines; checks cancel, writers queue | (a) |
| **lychee installer + direct run** | T-py `scripts/install-lychee.sh`, `scripts/check-links.sh` | Same gap as JS #293 (`.github/workflows/links.yml:85-118`) | **(b)** (same gap) |

## Python #148

| item | template evidence | local evidence | disposition |
|---|---|---|---|
| Line-limit gate path-component exclusions | T-py `check_file_size.py` | `scripts/check-file-line-limits.sh` uses case globs on git paths, which is equivalent | (a) |
| **shellcheck venv** | T-py workflow | Same gap as JS #300 (`.github/workflows/workflows.yml:95`) | **(b, low)** (same gap) |
| **lychee digest pins** | T-py `install-lychee.sh` | Same gap as JS #293 | **(b)** (same gap) |
| **Cache save only on main** | T-py `links.yml` | Same gap as JS #300 (`.github/workflows/links.yml:78-83`) | **(b, low)** (same gap) |
| **Line-limit gate covers shell** | T-py `scripts/check_file_size.py:23` (adds `.sh`) | `scripts/check-file-line-limits.sh:32` `EXTENSIONS='js\|mjs\|cjs\|py\|md\|yml\|yaml'`, so `.sh` and `.husky/*` are unchecked (largest: `scripts/preflight-credentials.sh`, 355 lines) | **(b, low)** |
| Docker `cache-to` | T-py | Docker is dormant (see JS #300) | (c) |
| Release race: dispatch a full CI run | T-py | Fails closed: "Remote main changed after validation; rerun CI on current main." (`scripts/version-and-commit.mjs:200-206`) | (c) |
| `check_dist_size.py` | T-py | Python dist only; same reason as the npm tarball gate | (c) |

**Port note (b):** add `sh` to `EXTENSIONS` in `scripts/check-file-line-limits.sh:32`, and include extensionless `.husky/*` hooks if desired. Confirm that every script is within the existing limit first; `scripts/preflight-credentials.sh` is 355 lines.

## Python #150

| item | template evidence | local evidence | disposition |
|---|---|---|---|
| **Dependabot action bumps break tests and the zizmor compatibility table** | T-py `scripts/check_zizmor_compatibility.py` (`read_pins` :16, `check_compatibility` :36), `tests/test_dependabot_updates.py` | Tests pin action tags: `tests/security-workflow.test.js:65-69,88`, `tests/docker-build.test.js:37`, `tests/docker-publish.test.js:124-127`, `tests/universal-app.test.js:88`, `tests/codeql-results.test.js:96`, `tests/workflow-reliability.test.js:329` (major tags via `toContain`, so major bumps fail); `tests/setup-buildx-resilient.test.js:12` exact `toBe('docker/setup-buildx-action@v4.4.1')`; `scripts/check-ci-workflows.mjs:9` `supportedZizmor = { 'v0.8.1': '1.32.0' }`, so any zizmor-action bump fails until edited | **(b, low)**; partly deliberate fail-closed |
| Dependabot health workflow | T-py | Only 3 Dependabot PRs ever (#97, #98, #99), all merged. Not a gate-correctness issue | (c) |

**Port note (b):** make the tests read the pinned tag from the workflow, or assert only the action name. Replace the exact `toBe` in `tests/setup-buildx-resilient.test.js:12` with a pattern. Keep the zizmor table fail-closed, but report the action and CLI pair clearly (as T-py `check_zizmor_compatibility.py` does) so a Dependabot PR shows what to edit. Alternatively, group the zizmor action with the table in Dependabot.

## Python #135

| item | template evidence | local evidence | disposition |
|---|---|---|---|
| `actions/cache` v6 | T-py | `.github/workflows/links.yml:79` `actions/cache@v6.1.0` | (a) |
| `zizmor-action` v0.8.1 | T-py | `.github/workflows/workflows.yml:170` | (a) |
| codecov action bump | T-py | codecov not used (grep `codecov` in `.github/` returns nothing) | (c) |

## Python #152

| item | template evidence | local evidence | disposition |
|---|---|---|---|
| Lock-based dependency audits | T-py | `npm audit --package-lock-only` on 3 lockfiles; "Audit resolved Python requirements" job | (a) |
| **Secretlint from the locked tree, not ad-hoc `npx -p`** | T-py `release.yml:212` `npm exec --prefix ... -- secretlint` | `.github/workflows/release.yml:278` `npx --yes -p secretlint@13.1.0 -p @secretlint/secretlint-rule-preset-recommend@13.1.0` runs before `npm ci`, so transitive deps are unlocked, although `package.json:133,161-163` already lock them and `package.json:73` has `check:secrets` | **(b, low)** |
| uv.lock, Python floors, pytest config, `Path.walk` | T-py | No Python package locally (only `experiments/benchmark` requirements) | (c) |
| Toolchain bumps (Python 3.15, Node 26, Ubuntu 26.04) | T-py | Template-specific runtime matrix; not a correctness fix | (c) |
| Dependabot `uv`, pip docs and pre-commit ecosystems | T-py `.github/dependabot.yml` | No such manifests. Local `.github/dependabot.yml` covers actions, npm (`/`, artifact-transport, universal-app) and pip (`experiments/benchmark`) | (c) |

**Port note (b):** move the secret scan after `npm ci` and run `npm run check:secrets` (or `npx --no-install secretlint "**/*"`). Combine this with the JS #300 `check-secrets.mjs` port.
