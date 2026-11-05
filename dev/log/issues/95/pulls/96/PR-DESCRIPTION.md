The main screenshot writer failed with `gh: command not found` in the pinned Playwright container ([failing run](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42080626844)). Install the official GitHub CLI with a pinned checksum and run a real, read-only credential-helper smoke check in the same container on PRs before the main writer. Both event filters now cover the writer's helper dependencies.

The complete JavaScript/Python template comparison also identified missing Python coverage. Add pinned Ruff checks and precommit formatting, Python CodeQL, Python file-size enforcement, and a metadata-only transitive requirements audit using uv/pip-audit. Add grouped weekly Dependabot updates for every actual manifest. Keep measured expensive test suites on separate shards when test files are added, and update status-gate count assertions for the new jobs. Existing release, runtime, artifact, Pages and scanner behavior is preserved; a patch changeset prepares the next release.

### Investigation and reproduction

- [Analysis, timeline, complete requirement mapping and options](dev/log/issues/95/pulls/96/ANALYSIS.md)
- [Template comparison and all 17 best-practice decisions](dev/log/issues/95/pulls/96/TEMPLATE-REVIEW.md), [individual CI path dispositions](dev/log/issues/95/pulls/96/TEMPLATE-PATHS.md), and complete source archives/tree inventories in the evidence directory.
- All seven cited runs, job metadata, annotations, full compressed logs and the original screenshot artifact are preserved under `dev/log/issues/95/pulls/96/`. The green-log error-like strings are passing test fixtures or echoed options; the historical Ubuntu migration notice is from GitHub's generated graph workflow.
- `python3 experiments/issue-95/verify-regression.py` substitutes the issue baseline workflows/size script and restores them after demonstrating seven failing regression checks. The isolated-PATH test reproduces the missing CLI without credentials. `verify-preview-tools.py` verifies the real downloaded CLI and credential helper.
- Shared template defect reported with a container reproduction, workaround and code suggestions: https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/285.

### Validation

- 90 focused Node tests, the additional dependency-update scope test, 13 shard/status integration tests, and five small Python audit unit tests passed locally.
- Real checksum-verified CLI installation/credential smoke and a 69-package hashed Python dependency audit passed, without installing NLP packages or models.
- Workflow policy, terminal-gate coverage, Ruff, ESLint/Prettier and shell precommit checks passed. New failure fixtures capture expected annotations so they cannot generate false CI errors.
- GitHub Actions verifies the actual pinned container, all full runtime/OS test shards, application builds/desktop packaging, workflow linting, artifact roundtrip, CodeQL and security audits. Final current-head results are recorded on this PR before readiness.

`CI_SCRIPTS_DEBUG=1` enables tool-path and audit-command diagnostics; it defaults to off. Main publication remains main-only, with PR smoke coverage for its environment.

Fixes #95
