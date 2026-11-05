# Issue 95: investigation and acceptance evidence

PR: https://github.com/link-foundation/sensitive-data-sanitizer/pull/96

## Outcome and scope

The actual failing main workflow could not find `gh` inside its Playwright container. The host runner's CLI is outside the container. PRs previously skipped the main-only screenshot writer and therefore never exercised its tool environment. This PR provisions a pinned, checksum-verified official CLI in both container jobs, adds a read-only PR smoke job that exercises the real Git credential integration, and makes the writer depend on that check. It also closes Python lint, formatting, size-limit, security-analysis, dependency-audit, and update-automation gaps discovered by comparing both templates.

The package API, scanner behavior, existing runtime matrix, artifact transport, release publishing, Pages behavior, and screenshot writer remain supported. This is a CI repair; it does not change the visual application. No before/after UI screenshot is needed. The original failed-run screenshot artifact is retained as evidence.

## Requirements inventory

The issue body, all comment endpoints, and sub-issue endpoint were read. At initial collection there were no issue comments, PR conversation comments, inline comments, reviews, or required sub-issues. The refresh under `github/` adds one informational Code Scanning setup bot comment, read in full; it adds no requested work.

| Requirement, including instructions accompanying the issue | Implementation / evidence | Verification |
| --- | --- | --- |
| Investigate all seven linked runs, including green and skipped runs | Complete logs, run/job metadata, annotations, diagnostic indexes in `ci-logs/`; triage below | Compare timestamps and exact source SHA; inspect every candidate diagnostic and annotation |
| Fix errors and false positives/negatives throughout CI | Container provisioning and read-only smoke gate; Python checks, CodeQL language, hashed dependency audit; explicit diagnostic classification | Before-fix regression experiment; focused tests; current-head GitHub Actions |
| Compare full file trees of JS and Python templates, every workflow and CI script | Pinned full archives, recursive trees, per-path byte comparison, full CI diffs; `TEMPLATE-REVIEW.md` and per-path review inventory | Every union path has a comparison state; all differing CI files and translated counterparts reviewed |
| Apply all relevant referenced CI best practices | Seventeen-principle applicability matrix in `TEMPLATE-REVIEW.md`; retain existing stronger release/security safeguards | Existing workflow-policy, timeout, concurrency, status-coverage and runtime tests plus new tests |
| Report shared template defects upstream | JS template issue 285, full report retained in `upstream-preview-report.md` | Reproduction, workaround, suggested code changes, official-image source and downstream failing log included |
| Collect logs/data in this repository under the requested directory | This directory, compressed raw logs/archives, metadata, research, and reusable `experiments/issue-95/` collectors | Collection summary and evidence index below |
| Reconstruct timeline; identify actual causes; compare possible solutions and plans | Timeline, problem/solution sections below and template review | Original log line numbers and immutable source revisions |
| Research existing components/libraries | Official GitHub CLI, Ruff, CodeQL, uv, pip-audit, Dependabot; primary sources below | Real CLI checksum/install/credential smoke and metadata-only dependency audit |
| Add disabled-by-default debugging if evidence is insufficient | Cause is proven; new tool checker and audit commands additionally support `CI_SCRIPTS_DEBUG=1` without credential output | Missing-tool and tampered-archive negative tests; real smoke with debug enabled |
| Apply across the entire codebase | Both event path filters, both container jobs, complete writer-helper import paths; every maintained Python helper; all tracked requirement manifests and npm locks | Parsed workflow tests, tracked-file discovery, fail-closed unsupported-manifest test, dependency-update scope test |
| Minimal reproducing regression test and reusable experiments | `tests/preview-tools.test.js`, Python audit unit tests, Python line-limit fixture; `experiments/issue-95/verify-regression.py` | Baseline has seven expected failures; repaired focused suite has 90 passing tests, plus dependency-update test, 13 integration checks and five Python tests |
| Prepare release and preserve work in regular commits | Patch changeset `.changeset/preview-container-tools.md`; atomic commits on prepared branch | Existing changeset/release CI, commit history, final clean-tree check |
| Finish one ready PR with current main integrated and all checks green | PR 96; no default-branch push or merge | Final PR check snapshot and main-ancestry check; readiness applied after checks |

## Reconstructed timeline (UTC)

| Time | Event and implication |
| --- | --- |
| 2026-10-07 20:05:22–20:07:44 | Historical automated pip dependency-graph run 37679381132 succeeded at `5f06c7d`. Its mutable Ubuntu runner notice belongs to GitHub's generated graph workflow. |
| 2026-11-05 18:03:46 | PR 93 merged as `510d98e`; this is the source of the five main workflow runs cited in issue 95. |
| 18:03:50 | Example app, Checks and release, Security, Workflows, and Broken Link Checker started against `510d98e`. |
| 18:04:22 / 18:04:40 | Links and Workflows passed. |
| 18:04:50.8499966 | Preview screenshot commit step reached `gh auth setup-git`; shell reported `gh: command not found`, exit 127. |
| 18:06:06 / 18:07:12 | Security passed; Example app ended failed because its terminal gate correctly saw failed `preview-regen`. |
| 18:10:25 | Automated version commit `c92be73` produced version 0.16.2; this is the issue's latest-main SHA. |
| 18:13:37 | Checks and release succeeded; release success does not establish screenshot-writer success. |
| 18:13:40–18:13:41 | Rerun-unacquired run 42082184911 was skipped at `c92be73`, consistent with a successful upstream release and no unacquired-runner condition. |
| 18:14:24 | Issue 95 opened. |
| 18:14:57 / 18:15:09 | Prepared task commit `725e686` and draft PR 96 created. Their successful checks are baseline evidence only. |
| 18:38:33 | First implementation CI started against `2a17882`; subsequent branch pushes are distinguished by exact SHA in the final CI snapshots. |
| 18:48:40 | The first entirely green matrix at `cb7a935` still emitted two genuine Deno budget warnings; green status was insufficient. |
| 19:19:25–19:28:10 | The final source matrix at `4d31a49`, including six balanced Deno shards and startup-aware scanner probes, completed successfully with no warning/error annotations. |

## Seven-run diagnostic triage

Line numbers below refer to decompressed `ci-logs/run-ID.log.gz`; `*.findings.txt` preserves the candidate line indexes. Original annotations are retained separately. No warning was suppressed to make a check green.

| Run | Observations and disposition |
| --- | --- |
| 42080626844, Example app | 2,366 log lines, three failure annotations. Lines 1357–1361 list five regenerated screenshots; these are expected generated output. Lines 1368–1370 show the writer command. **Line 1401 reports `gh: command not found`; line 1402 records exit 127.** Lines 2347–2350 show the aggregate gate correctly rejecting failed preview regeneration. Of the seven regex candidates, lines 547, 895 and 1769 merely echo an error branch in the successful desktop packaging shell script; the remaining four identify the missing CLI and its propagated failure. No desktop package output was missing. |
| 42080627175, Checks and release | 53,307 lines, no annotations. All 54 broad-regex candidates are passing test names/fixtures containing `Error: boom` or `Error: connect ECONNREFUSED`, repeated across runtime/OS shards. These are expected error-preservation tests, not emitted runtime errors. The job/step conclusions confirm success. |
| 42080626895, Security | 5,549 lines, no annotations. Two candidates are the action's echoed `expect-error: false` configuration, not errors or disabled checking. JavaScript/Actions scans passed, but the matrix omitted Python: that is a separately identified coverage false negative, corrected here. |
| 42080627191, Workflows | 1,486 lines, no annotations or diagnostic candidates; workflow validation passed. Standalone Python was not checked, which is a coverage gap rather than a failure hidden in this log. |
| 42080627286, Broken Link Checker | 544 lines, one notice linking the check summary, no warnings/errors. Link checks and second-pass classifications passed. |
| 42082184911, Rerun unacquired jobs | Skipped, zero job log lines/annotations. This is a conditional workflow-run recovery mechanism, not an unexecuted required application gate. Preserve skip semantics; forcing it to run on every success would waste resources. |
| 37679381132, generated pip graph update | 188 lines, success, one Ubuntu-latest migration notice. This historical workflow is generated by GitHub rather than a tracked YAML file; this PR cannot rewrite that historical runner. All repository-controlled runner labels are explicitly pinned. The existing upstream rollout announcement, runner-images issue 14748, is also saved under `github/`; no duplicate platform bug report is warranted. The new metadata-only audit independently covers the benchmark's Python dependencies. |

## Problems, root causes, options, and implemented plans

### 1. Missing container tooling and a PR coverage gap

The official Playwright image supplies browser binaries, system libraries, Node and Git, but does not promise GitHub CLI. The pinned Dockerfile confirms no CLI installation. Host-runner utilities are not inherited by container jobs. The existing mock tests verified writer logic without executing the image; the writer's main-only event condition left this environment failure undetected in PR CI. Its supporting helper paths were also incomplete in the workflow event filters.

Options considered: install from a rolling apt repository (extra mutable repository/configuration), add a third-party setup action (another executable trust dependency), publish a custom image (more build/storage maintenance), or install the official reviewed CLI archive with a repository-pinned digest. The last option is small and reproducible and is implemented.

Plan implemented: install official Linux x64 CLI 2.103.3 and verify SHA-256 before extraction; run a real, isolated `gh auth setup-git` / `git credential fill` smoke test with a dummy credential and no remote writes; run that job for PRs and main in the same pinned Playwright image; make the actual writer depend on it and repeat the preflight before builds; include every directly/transitively used writer helper in both trigger path lists. Unsupported platforms and checksum errors fail early. Temporary credential configuration is deleted on exit. Debug mode prints tool locations, never token values.

Reproduce the original failure without credentials using the Docker command in `upstream-preview-report.md`. Local tests remove `gh` from an isolated PATH and reject a deliberately invalid archive before extraction. `verify-preview-tools.py` downloads the real archive, verifies the pinned digest, and executes the real credential-helper check. The actual pinned container is exercised in GitHub Actions to avoid duplicating its download locally.

Shared upstream defect: https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/285. The image behaves according to its documented contract; no Playwright defect is asserted.

### 2. Maintained Python escaped lint, formatting, size, and CodeQL gates

The project is primarily JavaScript, and its existing checks used JavaScript extensions and a JS/Actions CodeQL matrix. Python exists in the published example bridge and maintenance/benchmark scripts. The Python template identifies the missing language coverage. Initial Ruff output found import/style problems, not a demonstrated scanner runtime defect.

Plan implemented: pinned Ruff 0.17.3 check/format in a five-minute CI job and precommit hooks; static checks cover all maintained Python, while immutable evidence remains excluded. Format the existing helpers and remove unused imports. Add Python to CodeQL while retaining historical experiment exclusions and scanning shipped examples. Include `.py` in the common 1,500-line gate with a real 1,501-line failing fixture. Trigger workflow checks for Python-only/config changes. Include the new job in the terminal gate. The project's production type checks remain JavaScript/TypeScript checks; there is no typed Python package `src/` to apply the template's package-oriented mypy configuration to.

### 3. Python dependency coverage and maintenance gaps

Existing npm audits cover all three npm lockfiles, but not `experiments/benchmark/requirements.txt`. A successful generated dependency-graph job is not a vulnerability audit. Installing Presidio/spaCy and model dependencies merely to audit them would waste substantial local resources.

Options: direct-package-only auditing (misses transitives), install all NLP packages (unnecessary memory/disk use and build hooks), or resolve metadata and audit a fully hashed dependency set. Implemented: automatically discover every tracked requirements file; reject newly introduced unsupported Python manifest formats until coverage is explicitly added; use pinned uv 0.13.7 with `--no-build` to produce a Python-3.13 hashed resolution; use pip-audit 2.10.1 with `--disable-pip --require-hashes` to audit without installation. Errors/advisories fail closed and other manifests are still examined. Five small mock-based unit tests cover discovery, unsupported manifests, exact command flow, resolution failure, and audit failure. The real benchmark resolution covered 69 packages and reported no known vulnerabilities; do not mistake this statement for a guarantee against future advisories.

Adopt the Python template's grouped weekly Dependabot policy, seven-day version cooldown, for GitHub Actions, all three npm manifest directories, and benchmark requirements. Dependency-update configuration is checked against tracked manifests. This provides proposed fixes as well as detection; security-update behavior retains Dependabot's separate advisory policy.

### 4. Integration checks exposed count and shard assumptions

The first full implementation run, 42086192032 at `2a17882`, correctly failed two existing integration tests. The preserved `ci-logs/node-first-failure.log` lines 3767–3768 show stale expected job counts (security now has five dependencies, formerly four); lines 3781–3782 identify expensive-test separation failure. The original alphabetical round-robin assigned heavy suites by their positions in the complete filename list. Adding test files shifted those positions and colocated measured subprocess-heavy suites, defeating the previous macOS Deno budget safeguard.

Implemented plan: update all three affected expected job counts; seed distinct shards with the measured expensive suites, then distribute remaining sorted files evenly and preserve sorted output. The final deterministic regression adds zero through twelve unrelated files for three-, four- and six-shard configurations, proving the six measured workloads stay distributed. Existing tests still prove exact-once coverage, runtime/OS completeness, balanced counts and directory-order independence. Thirteen focused integration tests pass. No timeout was increased. Some jobs in the superseded run were cancelled by the next head, which is expected cancellable-check concurrency, and is separately retained in annotations. Any unavailable cancelled-job log is recorded in the download stderr rather than invented.

### 5. Green checks still emitted genuine Deno budget warnings

Run 42087818623 at `cb7a935` passed every required check but emitted two real warnings: macOS Deno shards 2/4 and 3/4 crossed the 70-second warning threshold within the unchanged 100-second execution budget. Their actual completion times were 79 and 101 seconds, versus 55 and 45 seconds for the other shards. These are not fixture strings, and a green conclusion alone does not meet the issue's warning requirement.

`budget-profile-42087818623.json` records reproducible per-module timing sums and exact full-log line references. Shard 2 combined release API fixtures (54 seconds summed) with JSONL streams (27 seconds); shard 3 combined change discovery (65 seconds), budget timers (36 seconds), and release preflight (31 seconds). Module sums overlap under Deno's parallel execution, so they are evidence of workload concentration, not additive serial elapsed time. Multiple subprocess-heavy fixtures also compete for CPU on cold Intel macOS runners. Separating only the original three anchors did not cover these additional measured costs.

Options: raise the warning threshold (hides the resource pressure), serialize all tests (lengthens the job), or reduce and rebalance each job's workload. Implemented the latter: expand only macOS Deno from four to six shards and seed the six measured subprocess/timer/JSONL workloads separately. All runtimes retain every test exactly once and their existing per-test/suite budgets. `verify-shard-regression.py` restores the old setup, proves the updated separation checks fail twice, and restores the working source in `finally`. The repaired 47-test shard/timeout/workflow suite passes. Run 42090826860 confirms all six shards finished in 23–52 seconds with no budget warnings; its remaining failure is the separate startup-test problem below. Full timing sums are retained in `budget-profile-42090826860.json`.

### 6. A two-second subprocess deadline misclassified cold startup as slow scanning

Run 42090826860 at `76d5c2b` eliminated the Deno warnings but failed one Windows Bun test. `ci-logs/windows-bun-127468805165.log` lines 443–490 show `spawnSync node ETIMEDOUT` at the existing 2,000 ms whole-process deadline in `tests/issue-92-putty.test.js`; the test took 2,168 ms. The other 753 tests passed. The probe loaded the scanner's complete dependency graph (including RE2 WASM via `credentials.js` → `detection.js`) before scanning, but charged that startup against a scanner performance budget. The shared `runBounded` helper already documents observed Windows Node startup times exceeding ten seconds; these older PuTTY and whitespace tests had not adopted that separation.

The historical failure lacks phase markers, so it cannot independently prove how much time was spent initializing versus scanning. A bounded reproduction in `verify-probe-startup.mjs` adds a finite 2.1-second Node preload: the old whole-process deadline reliably returns `ETIMEDOUT`, while the actual scanner completes in about 2 ms. `probe-startup-reproduction.json` records separate startup and scan measurements. This establishes the false-positive mechanism; optional phase diagnostics make future failures distinguishable.

Options: shrink the adversarial witness (weakens regression coverage), simply enlarge the performance deadline (hides slow scans), or measure scanner execution after initialization while retaining an independent hang guard. Implemented the latter for **both** PuTTY and all four whitespace witnesses. Their two-second scan limit is now asserted inside each probe, after imports; the parent reuses the established 25-second process-tree hang guard beneath the existing 30-second per-test limit. Finite inputs and the 128 MiB child heap limit remain. The production scanner is unchanged. `CI_SCRIPTS_DEBUG=1` prints initialization/scan timings as captured JSON; it defaults off. The PuTTY test deliberately reproduces slow initialization and checks both timings. Fifteen focused tests pass under Node and Bun. Final source run 42092767310 passes the full matrix: the delayed-start PuTTY test succeeds in all nine runtime/OS combinations, including Windows Bun (merged log line 36265). All four whitespace probes pass as well.

## Verification and resource use

Final source/evidence head `4d31a49` has 59 passing checks and ten expected skips across five successful workflows, with no warning/error annotations. All six macOS Deno shards finish in 22–54 seconds, below the unchanged warning threshold. `VERIFICATION.md`, `github/final-source-evidence-summary.json` and the complete logs preserve exact SHA, timestamps, diagnostic classifications and successful-job completeness checks. The recovered security-download attempt is explicitly distinguished from its complete retry. The final evidence-only commit is checked live before PR readiness.

- `verify-regression.py` substitutes the issue baseline's three workflows and line-limit script, runs the targeted tests, and restores files in `finally`: seven failures before the fix (34 other tests pass), including missing PR environment gate, Python security coverage and a real oversized-Python fixture.
- The repaired focused Node suite passed 90 tests; the additional dependency-update manifest-scope test passed independently. Existing full cross-runtime/cross-OS matrices, app packaging, workflow linting, artifact roundtrip, CodeQL, and security checks run in CI rather than being duplicated locally.
- Five Python audit unit tests passed. Expected negative-fixture annotations are captured inside tests so successful tests do not emit false GitHub errors.
- Ruff lint/format, focused ESLint/Prettier, shell precommit checks, workflow policy and terminal status coverage passed. Installed tools and archives stayed temporary; no NLP libraries/models or Playwright container were installed locally.
- Real CLI installation/credential smoke and a real 69-package resolved audit passed; logs are retained. CI provides the same-image proof and validates all current changes at the PR's exact head SHA.
- `CI_SCRIPTS_DEBUG` defaults to off. Set it to `1` for new tool-path/audit-command diagnostics. Existing CI helper diagnostics, bounded retries and workflow diagnostic mechanisms are preserved.

## Primary sources and existing components

All research used official project sources. Immutable snapshots and release metadata are retained under `templates/` and `github/`.

- [Official Playwright Docker contract](https://playwright.dev/docs/docker) and [v1.59.1 image Dockerfile](https://github.com/microsoft/playwright/blob/v1.59.1/utils/docker/Dockerfile.noble): supplied tools and absence of `gh`.
- [GitHub Actions container execution](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idcontainer): job execution environment.
- [Official GitHub CLI Linux installation](https://github.com/cli/cli/blob/trunk/docs/install_linux.md) and [CLI 2.103.3 release](https://github.com/cli/cli/releases/tag/v2.103.3): supported prebuilt component; API asset digest saved in `github/gh-release.json`.
- [Ruff configuration](https://docs.astral.sh/ruff/configuration/): shared lint/format configuration, file discovery and exclusions.
- [CodeQL language matrix](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options): Python language coverage.
- [uv requirements compilation](https://docs.astral.sh/uv/pip/compile/) and [pip-audit](https://github.com/pypa/pip-audit): metadata resolution, hashed input and auditing without installation. PyPI release metadata for pinned tools is saved.
- [Dependabot options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference) and [cooldown release policy](https://github.blog/changelog/2026-07-14-dependabot-version-updates-introduce-default-package-cooldown/): weekly groups and explicit cooldown; security updates are distinct.
- [Node performance measurements](https://nodejs.org/docs/latest-v24.x/api/perf_hooks.html#performancenow) and [ECMAScript preloading](https://nodejs.org/api/cli.html#--importmodule): separate process initialization from scanner execution and reproduce slow initialization with a finite preload.
- [GitHub concurrency queue limits](https://docs.github.com/en/actions/reference/limits): preserve existing supported `queue: max` writer serialization rather than remove it to satisfy an older actionlint schema.

## Evidence index and reproducibility

- `github/`: complete issue/PR/comment/sub-issue metadata, run lists and related merged PRs. Large run history may be gzip compressed without removing bytes.
- `ci-logs/`: all seven cited full logs (gzip), metadata, paginated jobs, annotations and line-indexed candidates; later implementation runs collected in the same format.
- `preview-failure-artifact.zip`: original failing Example app's retained screenshot artifact.
- `templates/`: immutable full repository archives, complete recursive trees, byte-comparison inventory, CI/script diffs, referenced best-practices document and official-source metadata.
- Root `*.log.gz`, `*.log`, `python-resolved.txt.gz`, and audit JSON: local positive and negative validation, including pre-fix regression evidence. These are evidence, not source to lint or execute.
- `experiments/issue-95/`: reusable collection, full-tree comparison, regression, archive-integrity, budget profiling and real-tool smoke scripts. Regression substitution must run sequentially with staging/committing because it temporarily changes tracked files.

Raw logs can include passing fixture strings that resemble errors. Use the authored triage and job conclusions rather than counting regular-expression matches as failures. The final PR check snapshot is distinguished from earlier successful placeholder runs by head SHA and creation time.
