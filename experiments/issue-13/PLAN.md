# Issue 13 work plan

- [x] Confirm branch, clean starting tree, parent issue, and prepared PR.
- [x] Read all ten sub-issues and fetch all issue/PR comment types with pagination.
- [x] Read contributing rules and inventory shared APIs, CLI, examples, and tests.
- [x] Research primary standards and existing detectors/libraries; record sources and alternatives.
- [x] Write a complete requirement matrix and implementation/test plan for every issue.
- [x] Reproduce each reported failure with automated regression fixtures before implementation.
- [x] Add MRZ detection, document formats, travel identifiers, contextual birth dates, national IDs, and phones in shared native detection.
- [x] Add fixed-marker/minimum-length identity masking and explicit fake-value auditing, including residual verification.
- [x] Make long encoded runs non-blocking with bounded detection and audited fallback.
- [x] Add parseable structured JSON/JSONL APIs and CLI/session integration with explicit structural-field policies.
- [x] Add netrc, NuGet, WordPress, and PuTTY v3 credential rules and placeholder negatives.
- [x] Check all entry points, public type declarations, documentation, examples, and release changeset.
- [x] Run focused regressions and bounded performance experiments; preserve scripts under experiments/.
- [x] Run all Node, Bun, and Deno suites plus required lint/format/secrets/duplication checks; save large logs.
- [x] Preserve the implementation as an atomic commit after local checks.
- [x] Fetch the default branch and confirm it is already an ancestor.

## Publication protocol

1. Commit this research and the reusable experiments; push only the prepared branch.
2. Rewrite PR 14 title/body with requirements, reproduction, validation, alternatives, and all eleven closing references.
3. Review the published PR diff and verify a clean tree and current main ancestry.
4. List latest CI runs with timestamp/head SHA; download failing logs, diagnose and fix until checks pass on current head.
5. Mark PR 14 ready and report its URL with final results. The PR records the final published status.

No UI work is currently required. Do not stress unbounded inputs; finite fixtures and heap/stack limits apply to performance probes. No sub-agents are requested by repository guidance.
