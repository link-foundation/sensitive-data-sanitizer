# Issue 95 / PR 96 work plan

Objective: implement and verify every issue requirement in this PR, without merging it.

- [x] Read the complete issue, required sub-issues, PR conversation, inline comments, and reviews.
- [x] Preserve the reported runs, current main and PR run metadata, logs, annotations, and relevant repository history.
- [x] Inventory the full trees of both recommended templates; compare every workflow and supporting CI script against this repository and the referenced best practices.
- [x] Reconstruct the timeline and map every observed failure, warning, false positive, and false negative to its root cause and solution options.
- [x] Research primary sources and existing tools; report reproducible shared defects upstream where applicable.
- [x] Implement fixes consistently across all affected paths, add minimal failing regression cases and opt-in diagnostics wherever evidence is insufficient.
- [x] Add a release changeset, commit useful atomic steps, and push only issue-95-5445009fe5d0.
- [x] Run focused local checks within the container memory budget; use CI for full matrices and builds.
- [ ] Inspect final diff, verify main is integrated, update PR description with reproduction and evidence, and verify every current-head CI check.
- [ ] Refresh comments and requirements, preserve final evidence, ensure a clean tree, and mark PR 96 ready.

Evidence and acceptance mapping will be maintained in ANALYSIS.md and the files below this directory. Raw downloaded logs are retained separately from authored analysis. Skipped jobs are evaluated for their actual trigger/condition; a green aggregate alone is insufficient evidence.

Snapshot before final evidence push: implementation, local regression tests, review refresh and main ancestry are complete. Full final-head CI and readiness are checked on the live PR after this snapshot; the two remaining release conditions must pass before completion. No implementation requirement is deferred.
