# Issue 32 work plan

- [x] Verify branch, clean tree, repository instructions and existing PR.
- [x] Read parent issue, all six child issues, paginated comments and PR reviews.
- [x] Archive issue scope and enumerate every requirement, alternatives and plans.
- [x] Research primary sources and reusable components for names, IDs, phones,
      JSON spans and npm/Pages/Bun behavior.
- [x] List CI runs with timestamps and SHAs; preserve and analyze failing logs.
- [x] Trace all shared detection, structured, streaming, worker, CLI and policy paths.
- [x] Add minimum failing regressions before implementing each fix.
- [x] Fix name grammar and cross-script/cross-batch propagation with finite limits
      and protection against late confirmations.
- [x] Fix national-ID confidence and context; document effective defaults.
- [x] Fix public figures, booking/place/code negatives and plausible fictional phones.
- [x] Fix JSON escape span mapping and address/state line boundaries in every mode.
- [x] Add publication profile to API, declarations, CLI, docs and integration tests.
- [x] Identify Bun Windows failure, fix workflow handling of disabled Pages, verify
      release prerequisite and installed package; document any external blocker.
- [x] Run finite real-shaped session/throughput experiments under heap/stack limits.
- [x] Run complete Node, Bun and Deno suites sequentially, restore npm dependencies,
      and run lint, format, duplication, secret, syntax, size and documentation checks.
- [x] Add one Changeset; preserve useful atomic changes as commits after local checks.
- [x] Fetch latest main and verify it is already an ancestor of this branch.

## Post-push verification plan

The final run URLs and completion status are recorded in PR 33, keeping this
committed file as the pre-push checkpoint.

1. Push only issue-32-18721f994a02; update PR 33 title/body with tests, evidence and
   individual closing references for issues 26–32.
2. Review the whole `gh pr diff` for regressions, preserved features and scope.
3. Verify fresh exact-head CI; download/analyze every non-passing run and fix it.
4. Mark PR 33 ready, verify clean tree and current main ancestry, and report the
   result and remaining npm owner prerequisite.

Keep logs outside tracked source unless evidence is suitable for the case study.
Keep reusable probes in this directory; use finite corpora and memory/stack limits.
Wait for every launched command before completing the task.
