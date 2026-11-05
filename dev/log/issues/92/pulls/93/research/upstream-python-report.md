# Retry internal GitHub commit_refs_rules failures separately from repository rules

The JavaScript downstream release at https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42060440016 failed on 2026-11-05 at 16:03:47 UTC after creating its version commit:

```text
remote: fatal error in commit_refs_rules
! [remote rejected] HEAD -> main (fatal error in commit_refs_rules)
```

Inspection of this template's `scripts/version_and_commit.py` shows the same classification gap. `classify_push_failure` returns `PushFailure.OTHER` for this string, so `push_branch_with_rebase_retry` aborts instead of allowing a bounded retry of the unchanged commit. No Python template production failure is claimed; this is a reproducible shared helper defect exposed by downstream evidence.

Minimal reproduction:

```python
import sys
sys.path.insert(0, 'scripts')
from version_and_commit import classify_push_failure, PushFailure
result = classify_push_failure('remote: fatal error in commit_refs_rules')
assert result == PushFailure.OTHER  # demonstrates the missing transient class
```

To test recovery, mock `run_git_capturing` to return a `CompletedProcess` with return code 1 and this stderr, followed by a success. Assert identical push arguments, no rebase, and two calls. Also test three failures and GH013 combined with the internal-error text.

Workaround: inspect the remote commit and registry/release state before rerunning the release. Do not force push, bypass repository rules, or republish a version that already exists.

Suggested fix: introduce a transient classification for this exact internal GitHub failure and explicit HTTP 429/5xx errors; use at most three unchanged push attempts with backoff. Keep GH006/GH013 policy errors permanent, preserve stderr, and add default-off attempt/classification diagnostics. GitHub's internal trigger is unknown; an empty downstream rules API response is not proof that rules evaluation was disabled.

Analysis and bounded JavaScript regression tests are being implemented in https://github.com/link-foundation/sensitive-data-sanitizer/pull/93.
