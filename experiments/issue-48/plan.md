# Issue 48 work plan

- [x] Verify prepared branch and clean starting worktree; activate native completion goal.
- [x] Read parent, all three required issues and comments, native sub-issues, PR conversation, inline comments and reviews; check contributing guidance.
- [x] Record every acceptance criterion, alternative solutions and online primary-source research in docs/case-studies/issue-48/README.md.
- [x] Trace all Authorization detectors, environment-secret discovery, streaming APIs, CLI, types and docs. Reproduce bugs with failing minimal regression tests before fixes.
- [x] Fix #45 consistently for single/double/no quotes, escaped JSON, proxy headers, schemes and boundary characters while retaining existing credential coverage.
- [x] Fix #46 automatic env selection for auth configuration, preserving true credentials and explicit user selection.
- [x] Fix #47 file deadline behavior plus configurable bounded workers; provide opt-in NUL handling across API and CLI; measure and improve throughput/startup without dropping detectors or safety guarantees.
- [x] Preserve finite memory/stack/input sizes for experiments; retain reusable scripts under experiments or examples; save large logs and run memory-heavy tasks sequentially.
- [x] Investigate existing failing CI: list timestamp/SHA, preserve logs in ci-logs, identify exact errors, fix, validate.
- [x] Add Changesets release fragment, documentation, requirement-to-evidence map, and remove task placeholder .gitkeep.
- [ ] Run focused tests then full local tests and contributing checks; inspect PR diff for regressions and lost features; commit useful atomic changes with clear messages.
- [ ] Fetch/merge default branch as needed, push only prepared branch, update PR 49 title/body with reproduction, validation and Fixes #45/#46/#47/#48.
- [ ] Verify latest-SHA CI (download/analyze each failed run), resolve all failures, verify clean worktree, mark PR ready and complete native goal only when every criterion is met.
