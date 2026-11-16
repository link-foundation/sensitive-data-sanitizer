# Issue 210 / PR 211 evidence

Issue: https://github.com/link-foundation/sensitive-data-sanitizer/issues/210,
"Address all 3 open issues": #205, #206 and #207 in one pull request.

Start with [ANALYSIS.md](ANALYSIS.md). It holds the requirement list, root
causes, fixes and the tests that cover them.

Reusable scripts:

- `experiments/issue-205/short-given-names.mjs`: the reproduction from #205.
- `experiments/issue-205/case-forms.mjs`: every case form of each short given
  name, in both orders and with the surname initial.
- `experiments/issue-206/token-initial.mjs`: the reproduction from #206.
- `experiments/issue-206/initial-ends-token.mjs`: letters, digits and `-digit`
  after an initial, in Cyrillic and Latin.
- `experiments/issue-208/dump-budgets.mjs FILE.yml:JOB`: the step budgets
  charged to a job, now including retried attempts.
