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
- [x] Inspect the final source diff, verify main is integrated, update the PR description, and verify complete source-head CI including budget warnings (see VERIFICATION.md).
- [x] Refresh comments/requirements, preserve complete evidence, and prepare the final evidence-commit/current-head/clean-tree/readiness gate below.

Evidence and acceptance mapping will be maintained in ANALYSIS.md and the files below this directory. Raw downloaded logs are retained separately from authored analysis. Skipped jobs are evaluated for their actual trigger/condition; a green aggregate alone is insufficient evidence.

Final source head `4d31a49` passes all five workflows: 59 passing checks, ten expected release/optional skips, and no warning/error annotations. Six Deno shards finish in 22–54 seconds and every runtime/OS passes the startup regression. All successful jobs have complete logs. Main `c92be73` is integrated; all comment endpoints were refreshed and add no requirements.

Final live gate after the evidence-only commit: push only the prepared branch; wait for its exact-head checks; review any annotations; confirm main ancestry and a clean tree; mark PR 96 ready. The live PR records this final condition without creating a recursive commit of its own CI results. The native issue-completion goal remains active until that gate is complete.
