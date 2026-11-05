## Problem and changes

The reported release passed its validation jobs, then GitHub rejected the version commit with `fatal error in commit_refs_rules`. Successful security runs also contained high-severity CodeQL findings, while runtime guards, incomplete syntax discovery, obsolete dependencies and missing evidence checks could conceal failures.

- Retry transient push failures three times without changing the commit; keep permanent rule refusals actionable and attest release metadata against the validated parent before every push. Preserve locked dependencies during versioning, prevent post-validation source pulls, retain verified metadata-only recovery, and remove downloaded helper evaluation.
- Fix all five regex paths identified by the saved SARIF: PuTTY headers, booking references, tickets, visas and postal addresses. Keep finite subprocess regression probes with time and heap bounds.
- Bring the entire shared pipeline up to date against both template trees: strict SARIF/audit/artifact gates, explicit runtime skips, frozen Deno preparation, dependency hook policy, safe artifact transport and Pages deployment, scheduled links, runner-acquisition recovery, shell lint and writer queues. Preserve the product APIs, session-publication corpus, all nine runtime/OS combinations across 20 jobs and existing example platforms.
- Distribute Windows Bun and Deno fixtures across three complete shards each within the existing budget, separate the expensive macOS Deno subprocess fixtures across four stripes, and make temporary Git fixture line endings deterministic.
- Add a patch changeset for the automatic release workflow.

## Reproduction and verification

The captured push response fails the original helper; mocked regressions verify recovery, bounded exhaustion and permanent-policy refusal. All five original regex paths exceed finite two-second subprocess bounds. A temporary Git-repository experiment proves the old publisher can pull unvalidated source and the fixed publisher retains the tested commit. Normal credential/address fixtures verify preserved matching behavior after the regex fixes.

Focused automated checks cover push recovery, regex behavior, security evidence parsing (including abnormal npm audit execution), offline version/lock integrity, runtime skip visibility, artifact transport, workflow conditions and execution budgets. Implementation commit `b43e7b4` passes all five workflows: **52 successful jobs, 10 intentional skips and all 20 runtime jobs**, with zero warning/error annotations, npm/deprecation warnings or LF conversion warnings. All three npm locks report zero vulnerabilities at every severity. The [verification record](https://github.com/link-foundation/sensitive-data-sanitizer/blob/issue-92-255abc3c67f8/dev/log/issues/92/pulls/93/VERIFICATION.md) maps every requirement to evidence and links the exact runs.

[Complete analysis, timeline, 29 findings and requirement mapping](https://github.com/link-foundation/sensitive-data-sanitizer/blob/issue-92-255abc3c67f8/dev/log/issues/92/pulls/93/ANALYSIS.md). The same folder contains complete compressed historical logs, numbered annotations, repository/API responses, full template snapshots, bidirectional file inventories, research and before/after regression logs. [Template comparison](https://github.com/link-foundation/sensitive-data-sanitizer/blob/issue-92-255abc3c67f8/dev/log/issues/92/pulls/93/research/TEMPLATE-COMPARISON.md).

Shared defects reported upstream: [JavaScript dependency audit #284](https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/284), [JavaScript template #283](https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/283), [Python template #136](https://github.com/link-foundation/python-ai-driven-development-pipeline-template/issues/136). GitHub's internal server cause cannot be established from client logs; push classification diagnostics are available through `CI_SCRIPTS_DEBUG=1`, off by default. Live npm publishing remains restricted to main.

Fixes #92
