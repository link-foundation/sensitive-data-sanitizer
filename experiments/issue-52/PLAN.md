# Issue 52 work plan

Objective: implement issues 50 and 51 completely in PR 53, preserving the full detector union and public behavior outside the requested corrections.

- [x] Read parent issue, both native sub-issues, all issue comments, and PR conversation, inline comments and reviews (none at initial review).
- [x] Verify prepared branch, clean initial tree, contributing guidelines, related PR 49 and latest main.
- [x] Research Authorization token grammar, re2-wasm input handling and RE2JS iteration using primary upstream sources.
- [x] Inventory every requirement, candidate solutions and chosen plan in a case study.
- [x] Reproduce issue 50 before fixing: already-redacted scheme tokens, complete bracket placeholders, angle placeholder comparison, C0/NUL preservation.
- [x] Reproduce issue 51 before fixing with finite dense-token inputs; preserve baseline timing and bounded WASM-call evidence.
- [x] Fix shared Authorization range parser across native/context, synchronous/asynchronous, escaped JSON, file/stdin/stream and binary paths.
- [x] Remove match-count-dependent whole-view copies for every gitleaks rule; preserve capture groups, anchors, Unicode indices, entropy, long tokens and large-record fallback.
- [x] Add correctness, throughput and deterministic complexity regressions; keep reusable experiments here.
- [x] Add patch changeset as the repository's release trigger.
- [x] Run focused tests, complete Node/Bun/Deno suites sequentially with bounded heaps and concurrency, local lint/format/duplication/secrets/syntax/docs/version/changeset checks. Save large outputs under ci-logs.
- [ ] Commit useful atomic steps after checks; push only issue-52-5379832e5bd4.
- [ ] Review gh pr diff and verify no feature loss, requirement coverage, main ancestry and clean working tree.
- [ ] Rewrite PR title/body with reproduction, evidence and independent closing references for 50, 51, 52.
- [ ] List recent CI runs with timestamps and SHA. For every failed current-head run, download ci-logs/{workflow}-{run-id}.log, read actual errors in <=1500-line chunks, fix and verify.
- [ ] Wait for all current-head checks; re-read feedback; mark PR 53 ready once all criteria pass. Do not merge.

Resource limits: run memory-heavy commands sequentially; Node suites use --max-old-space-size=256 and --test-concurrency=1. Experiments use finite input sizes and a bounded V8 heap/stack; never repeat an OOM build without changing the approach.
