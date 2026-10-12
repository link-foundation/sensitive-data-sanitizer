# Issue 36 work plan

- [x] Read the complete issue, issue comments, PR conversation, inline comments,
      reviews, contributing instructions, and recent related PRs.
- [x] Verify the prepared branch and clean starting tree.
- [x] Trace structured detection/redaction, name and state labels, encoded
      detection, credential spans, IPv6, phone labels, and two-pass identity.
- [x] Add minimal automated regressions for every reported case before fixes;
      preserve baseline failures and bounded probes in this directory.
- [x] Fix root causes while retaining credential detection, explicit personal
      values, JSON validity, residual verification, and fail-closed publication.
- [x] Extend the existing session publication corpus with Codex turn_context /
      rate_limits and Claude attachment.tools / wireToolInputs / toolUseResult.
- [x] Add a patch Changeset for the automatic release and document reproduction,
      validation, assumptions, and remaining limits.
- [x] Run focused tests, all locally available runtime suites, corpus, lint,
      format, duplication, secrets, syntax, line limits, and release guards.
      Keep lengthy logs in dev/log/issue-36; run memory-heavy commands serially.
- [ ] Commit atomic changes, merge the latest default branch, and push only to
      issue-36-581486aaaa3f; update existing PR 37 with final scope and evidence.
- [ ] Inspect the complete PR diff for regressions and removed behavior.
- [ ] List CI runs with timestamps and SHA; download unsuccessful completed
      runs into ci-logs, read logs in chunks of at most 1500 lines, fix actual
      failures, and verify checks on the final commit.
- [ ] Mark PR 37 ready, confirm all work is committed and the tree is clean,
      and report the result with the PR URL.

Experiments use finite fixtures and a 512 MiB V8 heap. No private session files
were supplied; validation uses the public issue examples and repository corpus.

Local evidence: the initial 63-test regression run had 56 failures. Final full
suites passed 1,319 Node tests, 1,319 Bun tests, and 1,174 Deno tests plus eight
steps. Focused checks passed 238 tests, and all four extended corpus publications
had zero residual findings. Logs are retained in dev/log/issue-36.
