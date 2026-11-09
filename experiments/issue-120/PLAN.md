# Issue 120 work plan

Objective: implement every reported row in PR 121 and verify the final commit.

- [x] Read issue 120, its comments/sub-issues, all PR comment types and recent related PRs. No comments or required sub-issues exist.
- [x] Inspect document matching, proper-name overlap handling and strict age detection.
- [ ] Reproduce all ten reported rows with exact-output regression tests before editing source.
- [ ] Cover bracketed/Russian obfuscated email separators without losing local parts.
- [ ] Preserve complete military-ID findings alongside proper-name matches.
- [ ] Detect a lowercase employer after explicit employment context.
- [ ] Redact unknown capitalized Cyrillic words before colons in activated prose; preserve known labels and JSON keys.
- [ ] Preserve strict work/skill durations while retaining explicit and bare strict ages.
- [ ] Update superseded expectations, coverage/API documentation and a patch Changeset.
- [ ] Run focused regression and compatibility checks; record before/after evidence.
- [ ] Commit, push only the prepared branch, inspect the PR diff and integrate current main.
- [ ] Verify current-SHA CI, investigate any failures from preserved logs, update PR description and mark ready.

Assumptions: the colon change is limited to Cyrillic words in activated prose;
English labels retain existing behavior. Lowercase employers require an explicit
employment cue. A technology followed by a parenthesized year count is a skill
duration; a person's name followed by an age remains sensitive. Keep broad
document organization spans from combining separate proper-name replacements.

Related context: issue 87 and PRs 107/119 explain the existing preservation rules.
Release preparation uses a Changeset because manual version bumps are forbidden
by repository CI. Full runtime/OS and security checks run in CI.
