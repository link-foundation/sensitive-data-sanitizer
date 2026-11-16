# Issue 208: false positives, false negatives, warnings and errors in CI/CD

## Requirements

| # | Requirement (from the issue) | Where it is addressed |
| --- | --- | --- |
| R1 | Find and fix every false positive, false negative, warning and error in CI/CD | Findings F1–F17 below |
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

F1 to F6 are failures and warnings seen in CI logs. F7 to F14 are template best practices that were missing here. F15 to F17 surfaced while CI ran on this PR.

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
