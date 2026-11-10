# Issue 153 requirement and verification plan

- [ ] Preserve canonical short base64/base64url encodings of complete existing
      Hive masks through native, Gitleaks, and verification passes.
- [ ] Preserve first/last three credential characters and escaped GHCR log
      structure on the first call and on repeated calls.
- [ ] Reinspect bounded escaped JSON findings with the same configured policy,
      including exemption hooks and async detectors. Limit additional inspection
      to three levels; malformed and oversized views retain normal handling.
- [ ] Keep real credentials, exact known secrets, and uninspected views sensitive.
- [ ] Add failing-before/passing-after regressions, optional value-free tracing,
      a patch changeset, and a reproduction/verification report.
- [ ] Review all issue/PR comments and recent related work; merge latest main,
      commit and push only the prepared branch, review PR diff, update PR 160,
      wait for all current-commit CI, and mark ready without merging.

Issue and PR discussions were read in full. Issue 153 has one follow-up comment
and no sub-issues; PR 160 has no conversation/inline comments or reviews at the
start. The downstream PR 3741 probes and escaped-GHCR regression were read.
