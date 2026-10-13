# Issue 38 work plan

- [x] Read the complete issue, comments, PR 39 conversation, and the issue 36
      fix (PR 37) for style and corpus conventions.
- [x] Reproduce every reported record on `main`; keep the probes
      (`reproduce.mjs`, `residual-trace.mjs`, `covered-rules.mjs`) and a seeded
      fuzz (`fuzz.mjs`) in this directory.
- [x] Add failing regressions before the fixes in
      `tests/sanitizer-issue-38.test.js` with fixtures in
      `tests/fixtures/issue-38-sessions.mjs`.
- [x] Fix root causes: qualifier and verb boundaries, generic prose labels,
      quoted values bounded by the enclosing JSON string, credentials covering
      escaped JSON runs, and bounded fixed-point residual redaction.
- [x] Extend the session publication corpus with the issue records.
- [x] Add a patch Changeset and document the API, case study and limits.
- [x] Run the full suite, the corpus, lint, format and duplication checks;
      keep logs in dev/log/issue-38.
- [x] Commit atomic changes, push only to issue-38-bc8becdd8d18, and update
      PR 39.
- [x] Verify CI on the final commit, then mark PR 39 ready.

Experiments use finite inputs. No private session files were supplied;
validation uses the public issue examples and the repository corpus.
