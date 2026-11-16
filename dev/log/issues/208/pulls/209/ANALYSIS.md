# Issue 208: false positives, false negatives, warnings and errors in CI/CD

## Requirements

| # | Requirement (from the issue) | Where it is addressed |
| --- | --- | --- |
| R1 | Find and fix every false positive, false negative, warning and error in CI/CD | Findings F1–F22 below |
| R2 | Compare the full workflow and CI script trees with the JS and Python pipeline templates and adopt their best practices | `analysis/TEMPLATE-DELTA-REVIEW.md`; every (b) row is ported (F7–F14) |
| R3 | Report issues found here that also exist in the templates | [Upstream reports](#upstream-reports) |
| R4 | Follow hive-mind `docs/CI-CD-BEST-PRACTICES.md` | [Best-practices check](#hive-mind-ci-cd-best-practices) |
| R5 | Do everything in one pull request | PR #209 |

## Timeline

All times are UTC.

- 2026-11-15 23:00–23:58: on PR #204, runs 43771956351 and 43774378496 failed or were cancelled on several test legs. One leg was macOS node 3/3, log `ci-logs/pr204-43774378496-macos-node-3of3-133001200356.log`.
- 2026-11-16, after the merge of PR #204: commit `e2835dd` landed on `main`.
  - "Checks and release" run 43782250466 was **cancelled**. Job 133022147934, "Test runtimes (macos-26-intel, node, 2/3)", hit "The job has exceeded the maximum execution time of 15m0s". "Pipeline Status" then failed with "Pipeline has cancelled jobs".
  - The other `main` runs were green but logged warnings:
    - Windows printed `npm warn Unknown env config "global-ignore-file"`.
    - npm printed "install-scripts blocked" for `better-sqlite3@13.0.3`.
    - `pipx` printed a PATH warning in ShellCheck jobs.
    - The secret scan installed `@secretlint/secretlint-rule-preset-recommend`, which is deprecated.
- 2026-11-16 07:28: issue 208 opened.
- 2026-11-16 07:30 onward: PR #209 commits follow, in order, the findings below.

## Findings, root causes and fixes

F1 to F6 are failures and warnings seen in CI logs. F7 to F14 are template best practices that were missing here. F15 to F21 surfaced while CI ran on this PR, and F22 came from an independent review of the PR diff.

### F1. Cancelled macOS test leg on `main` (error)

- **Symptom.** The job timed out during `npm ci`, and GitHub shows a timeout as *cancelled*. The job log is gone (BlobNotFound), and the annotations only say that 15 min passed.
- **Root cause.** It cannot be proven from the evidence left. A normal `npm ci` on that runner takes at most 18 s, and every install we observed took at most 25 s. The leading hypothesis is npm's default `fetch-timeout` (300 000 ms) multiplied by 3 attempts (`fetch-retries` 2), which comes to about 15 min. That matches the backstop exactly, but no log confirms it.
- **What made it a CI defect.** The install had no step budget. A stalled registry therefore ran into the job's `timeout-minutes`. That lost the log and turned a failure into "cancelled", the opposite of what CI-CD-BEST-PRACTICES §17 asks for.
- **Fix (8966aed).**
  - Every networked install now runs under `scripts/run-with-budget-warning.sh`: `npm ci`, pip, pipx, uv, preview CLI downloads, and Deno preparation.
  - An overrun now fails with a titled `::error`, and it lists the processes still running when the budget expired.
  - `RUNNER_DEBUG` ("Re-run with debug logging") turns on budget tracing and npm `http` logging, so the next stall will show what it was waiting on. Both are off by default.
- **Invariant.** `tests/ci-timeouts.test.js` now covers every workflow. It parses the YAML, charges each local composite action once per call, and sums condition groups unless they are provably exclusive. It fails if any job's budgets exceed 70% of its `timeout-minutes`. The backstops it found too tight were raised. `experiments/issue-208/scan-unbudgeted.mjs .` now finds no unbudgeted install.

### F2. Quoted wrapper paths escaped the budget sum (false negative)

- **Root cause.** `BUDGET_PATTERN` expected whitespace right after `run-with-budget-warning.sh`. A step that calls `"$GITHUB_WORKSPACE/scripts/run-with-budget-warning.sh"` therefore added nothing to its job's sum.
- **Fix (8cbba46).** The pattern also accepts a closing quote, and a fixture covers it.

### F3. Windows nested npm fell back to npm 11 (warning, and a policy bypass)

- **Root cause, reproduced.**
  - The Windows image sets the npm global prefix to `C:\npm\prefix`. `npm install --global npm@12.2.2` therefore lands there, and the Node directory keeps its bundled npm 11.20.0.
  - `npm --prefix examples/universal-app run …` exports `npm_config_prefix=<app dir>` to child processes.
  - The `npm` shim next to `node` looks for npm under that prefix, finds none, and runs the bundled npm 11.
  - npm 11 does not know `global-ignore-file`, which npm 12 exports, so it prints the warning. It also skips npm 12's `devEngines` check and its `allowScripts` policy.
- **Fix (8966aed, 7634503).** `scripts/install-reviewed-npm.sh` replaces the npm in the Node directory and checks both the top-level npm and an npm run under another `--prefix`.
  - 8966aed did this with two installs. The Windows desktop job then spent 47–63 s in this step against a 60 s budget, and failed on 1f57376 (`ci-logs/example-app-43831456982.log`).
  - 7634503 installs into the Node directory first, running that directory's npm by path. The shims fall back to this copy when the configured prefix holds no npm, so a single install covers both cases. A second install runs only if the top-level npm still differs.
  - The script no longer spends `npm --version` calls on trace output when tracing is off.

### F4. `better-sqlite3` "install-scripts blocked" (false positive in npm, false negative in our test)

- **Root cause.** npm's lockfile does not record `gypfile`.
  - On `npm ci`, arborist sees `gypfile === undefined` and finds `binding.gyp`. It then synthesizes `node-gyp rebuild`, although the package sets `gypfile: false` and ships prebuilds.
  - `npm install` without a lockfile reads the packument and respects the flag.
  - Reproduced with npm 12.2.2 and 11.20.0. `npm ci` took 11 s and compiled; `npm install` took 3 s and did not. Logs: `upstream-reports/gyp-repro-{allow,deny}.log`; script: `experiments/issue-208/gypfile-lockfile-repro.sh`.
  - `tests/ci-audit-regressions.test.js` only looked at `hasInstallScript`, which is absent here, so the test missed it.
- **Fix (7823a09).**
  - The script is denied explicitly in `allowScripts`, because the prebuilds work.
  - The test now treats an installed `binding.gyp` as an install script.
- **Upstream.** Root cause and reproduction posted on npm/cli#9837.

### F5. Secret scan ran outside the lockfile with a deprecated preset (warning)

- **Root cause.** The lint job ran `npx --yes -p secretlint@13.1.0 -p @secretlint/secretlint-rule-preset-recommend@13.1.0` before `npm ci`.
  - Transitive versions were unlocked.
  - The preset package is deprecated, because secretlint 14 builds it into `@secretlint/core/builtin`.
- **Fix (7823a09).** The scan now uses secretlint 14 from the lockfile, through `npm run check:secrets` after `npm ci`, and the library uses `@secretlint/core/builtin`.

### F6. Deprecations published after locking passed every run (false negative)

- **Root cause.** The lockfile only carries the `deprecated` text npm saw when it resolved the package.
- **Fix (ec2a80e).** The npm-audit job asks the registry about each locked version.
  - Pull requests get a warning.
  - The weekly run fails.
  - An unanswered request fails closed.
  - `DEPRECATED_VERBOSE=1` traces the requests.

### F7. The CodeQL gate ignored tool notifications and printed SARIF text raw (false negative, injection risk)

- **Fix (a277793), ported from the JS template.**
  - Notifications at `warning` or `error` level fail the gate, and so do notifications without a message.
  - Logged text is JSON-quoted with `::` and `##[` escaped.
- **Follow-up (d4c3cf8).** Each finding line now names its `file:line`. Before this, the CodeQL failure on 1f57376 printed no location (`ci-logs/security-43831457236.log`).
  - That finding (`js/incomplete-sanitization`, `replace('/', …)` in a test URL helper) is fixed in the same commit.

### F8. Compressed and git-ignored tracked evidence was not scanned for secrets (false negative)

- **Fix (a3ae882), ported from the JS template.** `scripts/check-secrets.mjs` uses git as its inventory. It inflates gzip up to 128 MiB and reads tar members, and it fails closed on corrupt or unsupported archives.

### F9. The lychee parser merged adjacent records and counted redirects as failures (false negative and false positive)

- **Fix (d6b5444), ported from the JS template.** Records are matched one per line with `[ \t]`, and only the Errors section is parsed. The parser is shared with `check-web-archive.mjs`.

### F10. Unpinned lychee download, empty scans passed, PR runs wrote the main link cache

- **Fix (95c9345).** `scripts/install-lychee.sh` installs v0.24.2 with a pinned SHA-256 and runs under a budget.
  - A missing or empty report fails, and so does an unexpected exit code or a total of 0 checked links.
  - The cache is restored on every run and saved only from `main`.

### F11. JS checks were skipped when only `examples/` or `experiments/` changed (false negative)

- **Fix (2d44890), ported from the JS template.**

### F12. `pipx` PATH warning in every ShellCheck job (warning)

- **Fix (49ab3f0).** ShellCheck runs from a venv under `RUNNER_TEMP` with a budget. lint-staged passes `--no-path-check`.

### F13. zizmor `self-repository` exception list could drift (false negative)

- **Fix (35c00a0), ported from the JS template.**

### F14. Smaller template ports

- Husky errors are no longer ignored when an old `core.hooksPath` remains (57d2990).
- The 1500-line limit now covers `.sh` files and `.husky/*` (3d4c4bb).
- Workflow tests assert the shape of an action pin, not its literal tag, so Dependabot bumps stop breaking unrelated tests. The zizmor support-table failure names the pair to verify (1f57376).

### F15. Budget annotations were lost after output without a trailing newline (false negative)

- **Root cause.** GitHub parses `::warning`/`::error` only at the start of a line. If relayed output ended mid-line, the wrapper's annotation landed on that line and was dropped.
- **Fix (f016c64).** Same defect as JS template #304. In the Python template it is reported as #153.

### F16. Lint warnings on unchanged first lines were hidden (false negative)

- **Root cause.** `complexity` and `max-lines-per-function` report on a function's first line. The CI filter kept only warnings on changed lines, so an edit to a function body never surfaced them.
- **Fix (b4a2bfc).** CI reports every warning in a changed file, which is the scope of the lint-staged hook. It reports all warnings when the ESLint config, local rules or manifests change.
  - `LINT_VERBOSE=1` traces the decision.
  - `LINT_ALL_WARNINGS=1` reports everything.
  - Same defect as JS template #301.

### F17. Windows reviewed-npm step over its budget

- See F3. The step budget stays at 60 s. A raise to 90 s would have pushed three Linux jobs over their 70% backstops, so the redundant install was removed instead.

### F18. Ubuntu Bun suite past its budget warning (warning)

- **Symptom.** On 9f90431 the job "Test runtimes (ubuntu-24.04, bun, 1/1)" warned "Bun test suite has run for 140s of its 200s budget" and finished in 162s (`ci-logs/bun-133190645223.log.gz`). On `main` (e2835dd) the same suite took 137s (`ci-logs/bun-main-133022147761.log.gz`), 3s below the warning.
- **Root cause.** Bun runs test files one after another, and Ubuntu ran the whole suite in one job. The tests this PR adds cost about 25s. The biggest share is `tests/lychee-install.test.js` at 9.5s: it sets `LYCHEE_DOWNLOAD_RETRY_DELAY=0`, but curl reads `--retry-delay 0` as "use the default backoff", which starts at 1s. Every fixture also failed its first request, so each test waited through retries.
- **Fix.**
  - Ubuntu Bun now runs as two shards, like Bun on Windows (3) and macOS (6). Every other budgeted step in the run stayed at or below 63% of its budget.
  - Only the recovery test serves a first-request 503. The other lychee tests drop from about 2s to about 0.1s each.
  - The installer documents what a zero delay means to curl.
  - `tests/test-sharding.test.js` requires more than one Ubuntu Bun shard, each holding at most half of the files.

### F19. Expected error annotations on a green Buildx recovery job (false positive)

- **Symptom.** The jobs "Buildx registry recovery (recovered)" and "(exhausted)" passed, but carried `failure` annotations such as "500 Internal Server Error: simulated canonical registry outage" (`ci-logs/annotations-9f90431.tsv`).
- **Root cause.** The fixture injects registry outages. The upstream `docker/setup-buildx-action` annotates each one as an error, and GitHub cannot suppress the annotations of a `uses:` step.
- **Fix.** After asserting the outcome, the verification step adds a notice that names these annotations as the fixture's, so the annotation list explains itself.

### F20. macOS reviewed-npm install stalled past its budget (error)

- **Symptom.** On 6e8b74a the job "Test runtimes (macos-26-intel, bun, 6/6)" printed nothing from `install-reviewed-npm.sh` for 60s. It then failed with "Reviewed npm install did not finish within its 60s budget", leaving only the script itself running (`ci-logs/macos-bun-6of6-133205558054.log`). The other legs of the same run finished the step.
- **Root cause.** The script called `npm install` with npm's defaults. The default `fetch-timeout` is 300 000 ms, so one stalled registry request waits five minutes before npm retries it, far beyond the 60s budget. `experiments/issue-208/npm-fetch-stall.mjs` reproduces this offline against a loopback registry that never answers. With the defaults, npm was still waiting on its second request when it was killed at 20s. With bounded flags it retried and failed with `FETCH_ERROR` after 4 requests (`analysis/npm-fetch-stall.txt`). The budget itself worked as intended: it turned the stall into a titled failure in its own step, where F1 had cost a 15 min cancellation.
- **Fix.**
  - Both installs pass `--fetch-timeout=10000 --fetch-retries=3 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=5000`, so a stalled request is retried after 10s. Four attempts plus backoff end within about 47s, so the retries fit the 60s budget. A 20s first draft would have needed about 87s, and the budget would have cut the retries off (F22).
  - `INSTALL_NPM_FETCH_TIMEOUT_MS` overrides the timeout.
  - With `RUNNER_DEBUG` or `INSTALL_NPM_VERBOSE=1`, the script adds `--loglevel=http`, so the next stall names the request it waited on. It is off by default.
  - `tests/install-reviewed-npm.test.js` asserts the flags, the override and the tracing.

### F21. Issue-32 document-guard CPU limit failed on the macOS Intel runner (false positive)

- **Symptom.** On 6e8b74a, "Test runtimes (macos-26-intel, bun, 1/6)" failed `tests/sanitizer-issue-32.test.js` with "Expected 1149.577 to be less than 1000" (`ci-logs/macos-bun-1of6-133205558325.log`). The probe measures CPU milliseconds for sanitizing a 128 KiB tab suffix.
- **Root cause.** The limit measured the machine, not the guard.
  - That runner is uniformly slower. Small tests in the same file took 4–10× longer than on Ubuntu, for example 21.68 ms against 2.44 ms.
  - The probe timed the first `sanitize` call. That call pays a one-time initialization of about 200 ms locally, the same for a one-tab input, which is two-thirds of the 290 ms the probe measured.
  - The input-dependent part is linear: about 15 ms for 8 KiB, 33 ms for 32 KiB, 110 ms for 128 KiB and 400 ms for 512 KiB. The evidence is in `analysis/issue-32-cpu-calibration.txt` (`experiments/issue-208/sanitize-warmup-cost.mjs`).
- **Fix.**
  - The probe warms up before it signals readiness, so the two-second wall-clock deadline of `boundedProbe` covers only the measured work.
  - It then measures a 16 KiB and a 128 KiB suffix on the same machine, using main-thread CPU where `process.threadCpuUsage` exists. The test requires the growth to stay below 24×: linear matching gives about 8× (4.1–6.0× measured, also under load), quadratic about 64×.
  - Restoring the quadratic guard that ee9c30e replaced, as a temporary local edit, gave 56× and 29s. The new assertion and the deadline both still catch it.

### F22. Review of the PR diff (false negative, and retries that could never run)

An independent review of the script and workflow changes found these. Each is fixed:

- **Nested archives evaded the secrets scan (false negative).** `scripts/check-secrets.mjs` unpacked gzip members of a tarball, but scanned every other member as raw bytes. A tracked `bundle.tgz` holding `creds.zip`, or a `creds.zip.gz`, therefore passed unread. Nested members are now judged like tracked files: gzip is unpacked, and zip, plain tar, xz and the other unsupported formats fail the scan. Plain `.tar` files are rejected at the top level too, since a gzip member inside one stays opaque. `tests/check-secrets.test.js` covers four shapes and fails on the old scanner.
- **Retry chains longer than their step budgets.** A budget that kills curl or npm mid-retry replaces the script's own diagnosis with a generic budget error, and makes the retry settings dead code.
  - `install-lychee.sh` allowed 60s per attempt and 180s of retries, inside a 60s step. Now each download is bounded at 10s per attempt with no retry after 15s, so two downloads take at most 50s. `tests/lychee-install.test.js` computes this against the budget in `links.yml`.
  - `setup-preview-gh.sh` allowed 4 × 60s inside 90s. Now attempts are bounded at 20s with no retry after 50s, so the download ends within 70s.
  - The reviewed npm install is covered by F20's 10s request timeout.
- **A race could hide a budget annotation.** `run-with-budget-warning.sh` decided whether the relayed output ended mid-line from the file's current last byte. The command may already have written past the relayed range. A `::error` could then land mid-line, where GitHub ignores it. The check now reads the last relayed byte.
- **The self-repository check missed `uses:` with extra spaces (false negative).** `uses:  ./...` is now detected, and `tests/ci-workflow-policy.test.js` covers it.

The review raised further points that need no change:

- `--mode task` lychee output that the parser cannot read fails closed through the count check.
- A tracked file deleted locally crashes the local scan, which also fails closed.
- Warning-level CodeQL notifications failing the gate is the intended F7 behavior, and CI is green with it.
- The lint path handling for runs from a subdirectory predates this PR.
- The relative lockfile annotation path for sub-packages applies to no current matrix entry.

## Upstream reports

All reports were checked for duplicates first. They contain no personal data.

| Where | Report | Subject |
| --- | --- | --- |
| npm/cli | [#9837 comment](https://github.com/npm/cli/issues/9837#issuecomment-6911219534) | Root cause, reproduction, workaround and fix suggestion for `gypfile: false` being ignored on lockfile installs (F4) |
| JS template | [#305](https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/305) | 15 unbudgeted networked installs; the timeout test only reads `release.yml` and misses composites and quoted paths (F1, F2) |
| JS template | [#306](https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/306) | Deprecation check only reads the lockfile (F6) |
| JS template | [#301 comment](https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/301#issuecomment-6911576505), [#303 comment](https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/303#issuecomment-6911577615), [#304 comment](https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/304#issuecomment-6911577090) | Confirmations with the fixes applied here (F16, F15) |
| Python template | [#153](https://github.com/link-foundation/python-ai-driven-development-pipeline-template/issues/153) | Budget annotations lost after unterminated stderr (F15) |
| Python template | [#154](https://github.com/link-foundation/python-ai-driven-development-pipeline-template/issues/154) | Deprecated secretlint preset 13.1.0 in the lockfile; move to secretlint 14 (F5) |
| Python template | [#155](https://github.com/link-foundation/python-ai-driven-development-pipeline-template/issues/155) | 4 unbudgeted npm installs; the invariant counts only `*_BUDGET_SECONDS` lines (F1) |

Checked and not applicable to the templates:

- The Windows nested-npm skew (F3) does not apply to the Python template, because all of its npm jobs run on Ubuntu.
- The Python template has no changed-line lint filter (F16).

The report bodies are in `upstream-reports/`.

## Template comparison

`analysis/TEMPLATE-DELTA-REVIEW.md` lists every template change since the issue 95 review: JS #231, #288, #293 and #300, and Python #135, #139, #143, #148, #150 and #152.

- Each change is classified as (a) already present, (b) missing and applicable, or (c) not applicable, with file and line evidence.
- The review found 13 distinct (b) gaps. All of them are ported in this PR, as F5 and F7–F14.
- The (c) items are template-specific and don't apply here:
  - the Docker cache, which is dormant here;
  - tarball-size and E413 gates, since this package is small and has no binaries;
  - the Python toolchain and Dependabot ecosystems this repository does not have.

## Hive-mind CI-CD best practices

This was checked against `docs/CI-CD-BEST-PRACTICES.md`:

- **Runners:** pinned runner labels; no `-latest`.
- **Change detection:** jobs are gated on relevant changes (§1). F11 closes a gap there.
- **Line limits:** 1500 lines per file (§2), now including shell (F14).
- **Formatting and linting:** Prettier and ESLint (§3–4). F16 makes lint warnings visible.
- **Release flow:**
  - changesets (§6);
  - a fresh-merge simulation before checks (§7);
  - pre-commit hooks (§8);
  - an automated release with metadata-only commits and a classified rebase-and-retry push (§9).
- **Concurrency (§10):** read-only checks cancel and writers queue. Job conditions use `!cancelled()`. The only `always()` is a step-level summary.
- **Secrets detection (§11):** secretlint from the lockfile, including archives (F5, F8).
- **Links (§12):** pinned lychee with checks that the report is present and not empty (F10).
- **Workflow linting (§14):**
  - actionlint runs as a digest-pinned Docker image, which bundles shellcheck;
  - zizmor uses annotations and a confidence floor;
  - the exception list is now checked for drift (F13).
- **Dependency audit (§15):** lockfile-only `npm audit` on a schedule, plus live deprecation checks (F6).
- **Broken pipeline vs changed world (§17):**
  - Pull requests warn about registry deprecations and the weekly run fails.
  - Installs fail under their own name instead of being cancelled (F1).
  - Annotations reach the summary (F15).

## Verification

- Each fix comes with tests. The relevant files are:
  - `tests/ci-timeouts.test.js`
  - `tests/install-reviewed-npm.test.js`
  - `tests/run-with-budget-warning.test.js`
  - `tests/lint-changed-files.test.js`
  - `tests/codeql-results.test.js`
  - `tests/check-deprecated-packages.test.js`
  - the secrets, lychee and workflow-policy tests
- CI on the PR head runs all workflows on Ubuntu, macOS and Windows.

## Remaining uncertainty

- The cause of the stall in F1 is not proven, because GitHub deleted the cancelled job's log.
- That failure can no longer take the job down silently: it now fails in its own step, names the processes it was waiting on, and can be traced with `RUNNER_DEBUG`.
- F22's line-state race has no deterministic test. The window lies between two reads of a growing file. The fix is covered by the existing annotation tests.
- F20's log shows no npm output, so which request stalled is not proven. A stalled request matches the silence and the reproduction. Bounded retries cover that case, and the `http` log under `RUNNER_DEBUG` will name the request if it recurs.
