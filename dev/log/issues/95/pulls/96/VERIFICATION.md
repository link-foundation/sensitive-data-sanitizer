# Implementation verification snapshot

All five workflows below succeeded at implementation/evidence commit `cb7a935ae84fc8b8a1f4bd93dcdd50ed332148fb`. GitHub reported 57 successful checks and 10 intentionally skipped jobs. This proves the complete matrix and app builds, but two genuine macOS Deno budget warnings still required a follow-up. The six-shard repair and test-discovery follow-up are verified separately on the live PR before readiness.

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

The startup repair keeps the two-second scan assertion, separates initialization, and applies the same correction to all whitespace probes using the existing 25-second process-tree hang guard and 128 MiB child heap cap. The finite delayed-start regression and 15 tests pass locally under both Node and Bun. Final CI validation of this follow-up is pending at this snapshot; earlier green results are not substituted for it.
