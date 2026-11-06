# Issue 102 / PR 103 work plan

Objective: implement and verify every requirement of issue 102 in this PR, preserve
the dependency upgrades already merged, and record any external blocker honestly.
Prepared branch: `issue-102-b6ecf86c9f05`. Baseline: `15f86c0` (main),
`6889e93` (prepared PR). Research began 2026-11-05 UTC.

## Requirements and verification inventory

| ID | Requirement | Approach / possible solutions | Verification / status |
| --- | --- | --- | --- |
| R01 | Read full issue, comments, required sub-issues and all three PR comment types | Save authenticated GitHub API snapshots; follow required issue links | Complete. Full snapshots and final comment refresh in research/; one issue comment, zero PR comments/reviews, no required sub-issues. |
| R02 | Research online and compare existing components | Read official releases/migrations and dependency-update practices; compare npm-check-updates, uv, pip-audit, Dependabot/Renovate | Complete. ANALYSIS.md compares upstream components and links official migration/release sources; raw research preserved. |
| R03 | Diagnose every failure after merges 97, 98, 99 without reverting updates | Preserve timestamp/SHA-matched default-branch logs, reproduce exact failures | Complete. Baseline main logs and line references in ANALYSIS.md / VALIDATION.md; fixes preserve merged upgrades. |
| R04 | Update JS/TS first, all four manifests, all direct/dev dependencies across majors | Query npm registry before editing; npm-check-updates; migrate affected consumers | Complete. Registry-checked direct manifests, including dependency-free local adapter; npm tables and fresh-install logs. |
| R05 | Refresh every transitive npm entry and regenerate all three locks plus Deno lock | Fresh resolution, audit overrides/parent constraints, record every exception | Complete. Three fresh npm locks and frozen Deno graph; occurrence-level tables document every retained constraint. |
| R06 | Update Python second: benchmark and inline CI/hook tooling | Query PyPI, pin current releases consistently; resolve full benchmark graph | Complete with documented upstream constraints. Latest scanner/tool releases, full hash lock; Python 3.14.10 selected after actual 3.15 model-load failure. |
| R07 | Update GitHub Actions third, including composites and reusable workflow refs | Query release/tag APIs; update all occurrences and associated policy tests | Complete. All 67 Action occurrences mapped to 20 current releases; composites and policy consumers synchronized. |
| R08 | Update language/toolchain versions, base images, and shell-installed tools | Inventory workflow, Docker, hooks, documentation and scripts; synchronize active pins | Complete with documented Python/Java compatibility exceptions. dependencies/toolchains-and-images.* and actual Python smoke evidence. |
| R09 | Table of EVERY dependency: old version, registry latest, final version, exception reasons | Generate machine-readable snapshots and per-ecosystem review tables | Complete. Eight CSV/Markdown table pairs cover all graphs, Actions and tools, including removed/hoisted entries and exceptions. |
| R10 | Review changelog and migration guide for EVERY major bump | Link official migration evidence; adapt APIs and retain behavioral regression tests | Complete. ANALYSIS.md migration table and saved upstream releases; affected API consumers adapted and exercised. |
| R11 | Replace local logic/shims when upstream now supplies it | Inspect existing adapters, overrides, retries and platform APIs against newest versions | Complete. Upstream semver/cmd-shim/Buildx retries replace local implementations; necessary residual workarounds reported. |
| R12 | Honest version floors, remove obsolete upper bounds, synchronize duplicate pins | Review manifests, workflows, hooks, docs and Deno graph | Complete. Shared Node/npm/Python version sources, exact tooling pins, hash/frozen locks, current overrides and script approvals. |
| R13 | Full build/test/lint in every ecosystem with no new deprecations | Run sequential low-memory local checks; use existing CI for OS/runtime matrix and heavy builds | Complete for configured PR coverage. All 22 Node/Bun/Deno runtime jobs and Linux/Windows/macOS desktop builds pass; full lint/build/security workflows pass. Optional mobile jobs retain existing opt-in policy and are not counted as successful builds. |
| R14 | Zero unresolved security advisories | npm audit on all three committed locks; complete Python transitive audit; existing security CI | Complete. All three npm audits and full 69-package Python audit: zero findings. Current-commit Security workflow passes. |
| R15 | Report upstream bugs, missing features and duplicated general logic | Search existing reports first; create/update with bounded reproduction, affected versions, workaround and proposed fix | Complete. Eleven upstream reports/comments; exact bodies, searched discussions and returned URLs in upstream/ and research/. |
| R16 | Dependabot covers every ecosystem/directory including new manifests | Manifest discovery regression; update coverage as necessary | Complete. Existing Dependabot covers every dependency-bearing directory; manifest-discovery regression retained. |
| R17 | Minimal reproducing regression for each bug; tracing default off where necessary | Reproduce policy, formatter and npm lock failures; add focused behavioral tests | Complete. Minimal tests and bounded experiments cover stale pins, formatter/shim, lock metadata, npm setup and actual model load; debug tracing remains opt-in. |
| R18 | Preserve existing features and apply fixes throughout active codebase | Search all occurrences, review complete PR diff; immutable historical evidence remains historical | Complete. Active pins searched throughout; complete code diff reviewed; preserved historical results and all existing production behavior. |
| R19 | Release trigger and contributing style | Add patch Changeset; preserve automated versioning policy | Complete. Patch Changeset added; contributor/runtime documentation updated; existing automated release policy retained. |
| R20 | Atomic forward commits and pushes only to prepared branch | Verify branch before writes/push; no rewriting history | Atomic forward implementation commits pushed only to issue-102-b6ecf86c9f05; research/evidence publication is the final commit in this sequence. No history rewriting. |
| R21 | Merge latest main, clean tree, consistent final title/body with positive closing keywords | Fetch/merge main; inspect gh pr diff; update PR 103 with reproduction/tests/evidence | Latest main 15f86c0 is an ancestor; feedback refreshed; gh pr diff and all code changes reviewed; final title/body set. Clean-tree confirmation follows evidence publication and is recorded in the final PR verification comment. |
| R22 | All current-commit CI passing, including checks failing on main | Match timestamps/SHA, download non-passing logs, fix actual errors | Implementation verified: all five f52f391 workflows pass, 61 successful checks and 10 event-specific skips. Evidence-publication head is checked before readiness; see live checks and final PR verification comment for that SHA. |
| R23 | Default-branch CI green again using PR workflow (no direct merge to main) | Validate all affected pipelines on PR; report literal main-only criterion until changes land | External pending criterion: repaired main-only runs require normal PR merge. No main write or merge performed; not represented as achieved. |
| R24 | Mark PR ready only when implemented and verified | gh pr ready 103 after all actionable criteria pass | Finalization gate: mark PR 103 ready after evidence-publication head passes. Live PR readiness metadata and final verification comment record the completed action; no merge performed. |
| R25 | Preserve evidence in requested folder | Research, registry tables, failure line references, test/CI logs and final acceptance mapping | Complete. Index, analysis, requirement mapping, eight exhaustive inventory pairs, eleven upstream reports, registry snapshots and raw failure/success verification evidence are compiled in this folder. |

## Execution sequence

1. Finish baseline failure investigation and full dependency/version inventory.
2. Reproduce and fix existing upgrade regressions; commit this useful step.
3. Update npm dependencies/locks and migrate consumers, then Python, then Actions
   and toolchain/image pins. Document migrations and upstream reports.
4. Complete sequential local validation and security audits, commit/push, follow
   CI through completion, and fix every uncovered failure.
5. Refresh issue/PR feedback, review full diff, merge latest base, finalize evidence
   and PR description, and mark ready when acceptance evidence supports it.

## Resource and verification protocol

Use registry metadata rather than installing large NLP models locally. Run heavy
commands sequentially below the 2.92 GiB cgroup limit, log verbose output to files,
and inspect logs in chunks no larger than 1500 lines. Do not duplicate completed
full CI builds locally unless a failure requires reproduction. Test experiments
belong in `experiments/issue-102/`; permanent use cases belong in `examples/`.

For each non-passing CI run: record run timestamp/SHA, save complete logs under
`ci-logs/`, inspect the actual failure and relevant context, cite file/line evidence,
then check a new run on the corrected commit. Never infer a current result from an
older commit or present skipped dependent jobs as successful validation.
