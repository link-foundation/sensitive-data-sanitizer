The complete-tree comparison also reproduces an adjacent release-integrity gap in `scripts/version_and_commit.py` at template commit `78f2fdf5e085871387555bc066071f0aedd24479`. This is a controlled helper reproduction, not a claim of a Python production incident.

`check_remote_changes` treats a different remote commit as already released when its parsed version equals the local version. It does not inspect changed source or lock content or adopt the remote commit. When versions differ, it rebases onto that remote commit without establishing that its source and dependencies were validated. `push_branch_with_rebase_retry` similarly pulls/rebases after a push race.

Reproducer: download `experiments/issue-92/python-release-recovery.py` from the linked downstream PR and run `python python-release-recovery.py /path/to/python-ai-driven-development-pipeline-template`. It imports the actual template helper, mocks Git responses for distinct local/remote commits, and makes no network calls or Git mutations. It demonstrates both paths with finite inputs:

```text
REPRODUCED: different remote commit accepted using only matching version
REPRODUCED: unverified remote commit rebased without source/lock attestation
```

The complete script and captured output are preserved in https://github.com/link-foundation/sensitive-data-sanitizer/pull/93 under `experiments/issue-92/` and `dev/log/issues/92/pulls/93/python-release-recovery.log`.

Workaround: stop a release when remote source or locked dependencies have moved and rerun CI on the new main revision. Matching version strings alone are insufficient recovery evidence. Do not bypass branch rules or force-push.

Suggested code change: carry the validated SHA through release; permit only that checkout or an attested metadata-only child. Before accepting a prior version commit, compare the full source tree plus parsed manifest/lock content excluding the explicitly allowed version fields, then adopt the verified child. Fail on source/dependency drift. After any rebase, require the same attestation before pushing. Test matching-version source drift, different-version source drift, dependency changes, valid metadata-only recovery, and loss of the original validated parent. The downstream npm implementation now follows these checks; use TOML/uv-aware comparisons for this template.
