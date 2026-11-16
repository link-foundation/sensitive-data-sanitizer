# Issue 208 / PR 209 evidence

Issue: https://github.com/link-foundation/sensitive-data-sanitizer/issues/208,
"Check for all false positives, false negatives, warnings and errors in CI/CD
and fix them all".

Start with [ANALYSIS.md](ANALYSIS.md). It holds the timeline, the requirement
list, root causes, fixes and upstream reports.

## Layout

| Path | Contents |
| --- | --- |
| `ANALYSIS.md` | Case study: timeline, requirements, root causes, solutions, upstream reports |
| `analysis/TEMPLATE-DELTA-REVIEW.md` | Item-by-item comparison with the JS and Python pipeline templates (PRs since the issue 95 review) |
| `analysis/{js,python}-compare.txt`, `analysis/{js,python}-files.tsv` | File-tree comparison with the templates |
| `analysis/budgets-now.txt` | Per-job step budgets as charged by `tests/ci-timeouts.test.js` |
| `upstream-reports/` | Bodies of the issues filed in the templates, the npm/cli comment, scan output, and the `gypfile` reproduction logs |
| `ci-logs/` | Downloaded logs of the failing and relevant runs (main before the fix, and this PR) |
| `main-runs.json`, `recent-runs.json`, `recent-failed-jobs.tsv` | Run and job listings at the time the issue was opened |
| `e2835dd-jobs.tsv`, `e2835dd-annotations.tsv` | Jobs and annotations of the `main` commit named in the issue |
| `checks-and-release-43782250466.json` | Job list of the cancelled "Checks and release" run on `main` |

Reusable scripts live in `experiments/issue-208/`:

- `gypfile-lockfile-repro.sh [allow|deny]`: shows that `npm ci` compiles
  `better-sqlite3` although the package sets `gypfile: false`.
- `scan-unbudgeted.mjs <repo-dir>`: lists workflow steps that run a networked
  install without a step budget. It reads the YAML as data only.
- `dump-budgets.mjs <workflow.yml:job>...`: prints the budgets charged to a job.

Template clones were read as data and never executed.
