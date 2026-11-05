# Final source verification

All five workflows succeeded at `4d31a49b8f38114366447f69ab9f28e78869da90`, created **2026-11-05 19:19:25 UTC**, after the last source fix `cdd99fc`. GitHub reports **59 successful checks and 10 expected skips**, with **zero warning/error annotations**. Every successful job with steps is represented in the complete downloaded logs; `github/final-source-evidence-summary.json` records that check.

| Workflow | Result | Full log lines | Run |
| --- | --- | --- | --- |
| Checks and release | success | 47,088 | https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42092767310 |
| Example app | success | 1,930 | https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42092767273 |
| Security | success | 8,443 | https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42092767280 |
| Workflows | success | 1,770 | https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42092767768 |
| Broken Link Checker | success | 567 | https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42092767377 |

The six macOS Deno shards finished in **54, 22, 35, 38, 33 and 31 seconds** (shard order), all below the unchanged 70-second warning threshold. See `budget-profile-42092767310.json`. The delayed-start PuTTY regression passed in all nine runtime/OS combinations; Windows Bun completed it in 2,314 ms (merged log line 36265), including the deliberate 2.1-second preload. All four whitespace probes pass too. The two-second scan assertions and finite heap/input bounds remain enforced.

All 54 diagnostic candidates in the runtime log are passing `Error: boom` / `Error: connect ECONNREFUSED` preservation fixtures. Security's three candidates echo `expect-error: false`; the app's three candidates echo a successful packaging script's error branch. The link checker emits one informational summary-link notice. There are no unclassified warnings or errors.

The first security log download returned Azure HTTP 503 (`Egress is over the account limit`) and only 183 lines. That partial attempt and stderr are preserved explicitly as such. Retrying recovered the complete original ZIP and 8,443-line merged log, verified against all ten successful jobs. The collector's candidate count alone is not evidence of completeness.

The first evidence-only head `8d1af03989cf8a4d0f13a85ce7c2e87c2f27e268` also passed all five workflows: **30 successful checks and 18 expected skips**, without warning/error annotations. Its complete logs and `github/checks-evidence-8d1af03.json` are preserved. The change detector compares the already-validated `4d31a49` to `8d1af03` (run 42094776446, merged log lines 379–429) and finds only evidence files, so it skips repeating the unchanged runtime matrix and other source gates. The complete source matrix above supplies the required source verification; skips alone do not.

A subsequent classification-only evidence update documents the historical OpenSSL bundle message found by a broader scan. It changes no source. Its current-head checks and readiness are verified live using the same final gate.

The final evidence commit contains only investigation data/docs. After it is pushed, verify its exact current-head checks, main ancestry, clean working tree and PR readiness live. Those checks are recorded by GitHub, avoiding a recursive commit of the evidence commit's own CI logs. This source snapshot proves all source changes independently; no failure is waived by an evidence-only commit.

# Earlier implementation verification

All five workflows below succeeded at implementation/evidence commit `cb7a935ae84fc8b8a1f4bd93dcdd50ed332148fb`. GitHub reported 57 successful checks and 10 intentionally skipped jobs. This proves the complete matrix and app builds, but two genuine macOS Deno budget warnings still required a follow-up. The final source verification above supersedes this earlier snapshot.

| Workflow | Created (UTC) | Result | Run |
| --- | --- | --- | --- |
| Broken Link Checker | 2026-11-05T18:48:40Z | success | https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42087818821 |
| Workflows | 2026-11-05T18:48:40Z | success | https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42087818680 |
| Security | 2026-11-05T18:48:40Z | success | https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42087818612 |
| Example app | 2026-11-05T18:48:40Z | success | https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42087818618 |
| Checks and release | 2026-11-05T18:48:40Z | success | https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42087818623 |

Skipped checks:

- Optional Docker Hub Publish
- Build Docker Image
- Configure Docker Hub Publish
- Instant Release
- Release
- Create Changeset PR
- Regenerate Preview Images
- Deploy GitHub Pages
- Build iOS app
- Build Android app

These skips preserve main-only writers, releases and optional mobile/Pages jobs. The preview environment check runs for PRs and passed in the actual pinned container. No failing check is counted as a skip.

All full logs, annotations and diagnostic candidates for these runs are saved under `ci-logs/`. In passing Security, the only three candidates echo `expect-error: false`; in passing Example app, the only three echo the desktop-output error branch. Checks-and-release includes 54 passing fixture strings and two real macOS Deno budget warnings. Shards 2/4 and 3/4 finished in 79 and 101 seconds, respectively. See `budget-profile-42087818623.json` and ANALYSIS.md problem 5 for the measured concentration of subprocess/timer/JSONL workloads and the six-shard repair. A passing workflow does not waive those warnings; current-head timings and annotations must be reviewed before final readiness.

The two earlier failed implementation runs are also retained. They exposed stale job-count assertions and filename-sensitive heavy-suite placement; both were repaired without increasing timeouts. The final source/test diff was reviewed against PR 96, and default main `c92be73b6e212bbd67771e86cee215e3d631af83` is an ancestor.

Archive integrity is reproducible with `python3 experiments/issue-95/verify-evidence.py`. No npm publication, main-branch push or default-branch merge is performed to validate this PR.

## Six-shard verification and startup follow-up

At `76d5c2b82e82457e0f14c2e29d6251ca68cbe748`, the four app/security/workflow/link runs succeeded. Checks-and-release run [42090826860](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42090826860) failed exactly one Windows Bun PuTTY probe: its whole-process two-second deadline included cold Node/module initialization. All six macOS Deno shards succeeded in 41, 41, 52, 25, 49 and 23 seconds (shard order), with **zero budget warnings**. Full logs, annotations and `budget-profile-42090826860.json` preserve both outcomes.

The startup repair keeps the two-second scan assertion, separates initialization, and applies the same correction to all whitespace probes using the existing 25-second process-tree hang guard and 128 MiB child heap cap. The finite delayed-start regression and 15 tests pass locally under both Node and Bun. The final source verification above confirms this follow-up across the complete runtime matrix; earlier green results were not substituted for it.
