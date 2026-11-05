# Release push recovery misses GitHub's internal commit_refs_rules error

Observed in downstream https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42060440016 (2026-11-05 16:03:47 UTC). Full logs and regression evidence: https://github.com/link-foundation/sensitive-data-sanitizer/pull/93.

The current template's `scripts/push-failure-classifier.mjs` and `scripts/push-main-with-rebase-retry.mjs` also do not recognize this response:

```text
remote: fatal error in commit_refs_rules
! [remote rejected] HEAD -> main (fatal error in commit_refs_rules)
```

The version commit is created successfully, but the helper fails immediately before publishing. This is distinct from GH006/GH013 policy violations and non-fast-forward races. Repository rules APIs currently return empty lists downstream. That does not establish GitHub's internal root cause; the log establishes only that GitHub rejected the ref update inside its rules engine.

Reproduce without a real remote: import `pushWithRecovery`, inject a runner returning `{code:1, stderr:'remote: fatal error in commit_refs_rules'}` for the first push and `{code:0}` for the second, and assert two identical `git push origin HEAD:main` calls. The current helper throws after the first call.

Workaround: inspect the remote version and npm/GitHub release state, then rerun the failed release. Do not manually republish an already registered version, disable protection, or treat this response as a merge conflict.

Suggested implementation: classify the exact internal error (and explicit transient HTTP 429/5xx responses), retry the unchanged ref update at most three times with backoff, preserve the final stderr, and reject GH006/GH013/authentication errors immediately. Add a default-off diagnostic mode recording attempt, exit code and classification without credentials. Test success on the next attempt, exhaustion, and precedence of permanent rule errors.

Related safety gap: the template stages all files before pushing a version commit, and the push helper can automatically merge a release PR when rules reject it. The linked hive-mind best practices now require metadata-only release commits and explicit failure on a rule-blocked version push. Reuse `assertReleaseMetadataOnly` before each release push, require the validated parent SHA, and disable the PR fallback for release commits while preserving explicitly requested changeset PRs. A rebase onto an unvalidated parent must fail attestation.
