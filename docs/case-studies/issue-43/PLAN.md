# Issue 43 implementation and verification plan

Objective: implement issues 40, 41 and 42 in PR 44, preserving all existing features.

- [x] Read parent and native sub-issues, comments, PR conversation, inline comments and reviews (all comment/review collections empty at start).
- [x] Verify prepared branch and working tree; read contributing guidelines and recent merged PR styles.
- [x] Research upstream tool practices and existing libraries; inventory every prose requirement and map alternatives, implementation and evidence.
- [x] Add failing minimal regressions before fixes: OpenAI token boundaries; local IPs; auth metadata; shell/template expressions; npm names/versions; Actions permissions; real credentials.
- [x] Trace slow native rules and encoding scans with finite heap/CPU/input limits, retaining experiment scripts and logs.
- [x] Remove quadratic matching and verify repeated-character, random/zero-run base64 and 15 MB inputs with retained timing evidence.
- [x] Support lossless non-UTF-8 text publication across file, streaming, workers and two-pass paths while preserving strict structured-text validation.
- [x] Discover secret-named environment values automatically, retain explicit-name selection, and collect local gh hosts.yml credentials safely and explicitly.
- [x] Support long records with safe limits and no split-token/header leaks; document memory behavior and verify chunk-boundary cases.
- [x] Add credentials-only selection across all APIs, CLI, workers and nested encodings; preserve strong credential detection.
- [x] Investigate npm E404 and release history; make publication checks actionable, validate packed install/API/CLI; publish if authorized credentials permit, otherwise document exact external blocker.
- [x] Add one minor Changeset, API/README guidance, upstream integration example and complete requirement/evidence matrix.
- [x] Run local CI checks and full runtime suites sequentially within container memory limits; commit atomic verified steps.
- [x] Fetch and include current main, push only prepared branch, update PR title/body with Fixes #43, Fixes #40, Fixes #41 and Fixes #42.
- [x] Inspect recent CI timestamps/SHAs; save failed-run logs to ci-logs, read actual errors, fix and verify all checks on final head.
- [x] Review complete PR diff for regressions and scope; confirm clean tree, ready PR 44 and report remaining blocked criteria explicitly.

- [ ] REQUIRED, externally blocked: actual npm publication and registry installation; owner credential / trusted-publisher configuration is absent. Keep PR unmerged.
