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
- [ ] Inspect the final source diff, verify main is integrated, update the PR description, and verify complete current-head CI including budget warnings (see VERIFICATION.md).
- [ ] Refresh comments/requirements and preserve evidence; execute final current-head/clean-tree/readiness checks against the live PR.

Evidence and acceptance mapping will be maintained in ANALYSIS.md and the files below this directory. Raw downloaded logs are retained separately from authored analysis. Skipped jobs are evaluated for their actual trigger/condition; a green aggregate alone is insufficient evidence.

The measured six-shard repair is verified: all six macOS Deno jobs completed in 23–52 seconds without warnings. That matrix exposed a separate Windows probe startup deadline; the repair and finite delayed-start regression pass 15 tests under Node and Bun. Full CI validation of this last follow-up remains pending at this snapshot. Readiness requires passing current-head CI with warnings reviewed and the tree clean. The live PR records that final condition without creating a recursive commit of its own CI results.
