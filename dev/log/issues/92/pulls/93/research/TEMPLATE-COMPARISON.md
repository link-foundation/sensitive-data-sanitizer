# Template comparison

Complete source archives and recursive GitHub trees are saved next to this document. The two `*-full-inventory.json` files compare every upstream and tracked local path in both directions, with SHA-256 identities; application-specific files are retained. `*-comparison.json` preserves the pre-change comparison.

## File-tree review decisions

| Area | JavaScript template | Python template | Repository decision |
| --- | --- | --- | --- |
| Workflows | All eight workflows examined | All workflows and pipeline scripts examined | Adapt release, security, workflow lint, links, example app and runner recovery. Do not add JavaScript-first demonstration workflows: this repository already publishes JavaScript and has no Python/Rust package release. |
| Package/build | npm package, JS-first demonstrations, desktop/browser/mobile example | pyproject, uv/pip, Python release and examples | Preserve sanitizer exports, CLI, docs, corpus and browser app. Reuse generic npm and desktop hygiene only. Python publication/build commands do not apply to an npm package. |
| Release | Changesets, OIDC, integrity validation | TOML version parser, scriv, PyPI OIDC | Keep Changesets and npm OIDC; transfer release validation/fail-closed principles. Shared transient push defect reported in both projects. |
| Security | CodeQL strict result gate, npm audit, dependency graph | language-specific static analysis, audit and graph checks | Apply strict evidence and graph preflight. No Python dependency lock exists here; the example bridge remains shipped and documented. |
| CI infrastructure | pinned tooling, artifacts, Pages, link recovery, status, retries | corresponding cross-language patterns | Adapt shared tested helpers; preserve 15-leg Intel macOS sharding and the sanitizer session-publication job. |
| Documentation/tests | template docs and arithmetic examples | Python API/tutorial/tests | Preserve product behavior; copy applicable CI regression tests and adapt project matrix/fixtures. Omit template-only language demonstration tests and arithmetic-specific tests. |
| Historical evidence | case studies and development logs | case studies and captured CI logs | Preserve snapshots verbatim; exclude evidence from source lint/scanners/formatters/link checks. |

## Every JavaScript CI helper

All shared scripts were diffed against the template. Generic improvements are adopted; unchanged helpers are retained byte-for-byte. The table inventories every template script, including deliberate local adaptations.

| Script | Decision |
| --- | --- |
| `artifact-files.mjs` | Identical upstream helper retained/adopted |
| `artifact-transport.mjs` | Identical upstream helper retained/adopted |
| `bootstrap-dependencies.mjs` | Identical upstream helper retained/adopted |
| `changeset-version.mjs` | Identical upstream helper retained/adopted |
| `check-artifact-archive.mjs` | Identical upstream helper retained/adopted |
| `check-changesets.mjs` | Identical upstream helper retained/adopted |
| `check-ci-workflows.mjs` | Identical upstream helper retained/adopted |
| `check-codeql-results.mjs` | Identical upstream helper retained/adopted |
| `check-dependency-graph.sh` | Identical upstream helper retained/adopted |
| `check-desktop-compat.mjs` | Identical upstream helper retained/adopted |
| `check-docker-build.mjs` | Identical upstream helper retained/adopted |
| `check-docker-publish.mjs` | Identical upstream helper retained/adopted |
| `check-file-line-limits.sh` | Adapted for release attestation, project coverage or diagnostics; see PR diff |
| `check-javascript-syntax.mjs` | Identical upstream helper retained/adopted |
| `check-mjs-syntax.sh` | Identical upstream helper retained/adopted |
| `check-package-manager.mjs` | Identical upstream helper retained/adopted |
| `check-pages.sh` | Identical upstream helper retained/adopted |
| `check-pipeline-status.sh` | Identical upstream helper retained/adopted |
| `check-release-needed.mjs` | Identical upstream helper retained/adopted |
| `check-required-docs.sh` | Identical upstream helper retained/adopted |
| `check-staged-formatting.mjs` | Identical upstream helper retained/adopted |
| `check-status-gate-covers-all-jobs.mjs` | Identical upstream helper retained/adopted |
| `check-version.mjs` | Identical upstream helper retained/adopted |
| `check-web-archive.mjs` | Identical upstream helper retained/adopted |
| `create-github-release.mjs` | Identical upstream helper retained/adopted |
| `create-manual-changeset.mjs` | Identical upstream helper retained/adopted |
| `debug-print.mjs` | Identical upstream helper retained/adopted |
| `deploy-pages.mjs` | Identical upstream helper retained/adopted |
| `detect-code-changes.mjs` | Identical upstream helper retained/adopted |
| `format-github-release.mjs` | Identical upstream helper retained/adopted |
| `format-release-notes-helpers.mjs` | Identical upstream helper retained/adopted |
| `format-release-notes.mjs` | Identical upstream helper retained/adopted |
| `github-actions-log.mjs` | Identical upstream helper retained/adopted |
| `github-api-evidence.mjs` | Identical upstream helper retained/adopted |
| `github-api.mjs` | Identical upstream helper retained/adopted |
| `github-release-state.mjs` | Identical upstream helper retained/adopted |
| `install-git-hooks.mjs` | Identical upstream helper retained/adopted |
| `instant-version-bump.mjs` | Identical upstream helper retained/adopted |
| `js-paths.mjs` | Identical upstream helper retained/adopted |
| `land-via-pull-request.mjs` | Identical upstream helper retained/adopted |
| `lint-changed-lines.mjs` | Identical upstream helper retained/adopted |
| `lint.mjs` | Identical upstream helper retained/adopted |
| `lychee-report.mjs` | Identical upstream helper retained/adopted |
| `markdown-lines.mjs` | Identical upstream helper retained/adopted |
| `merge-changesets.mjs` | Identical upstream helper retained/adopted |
| `npm-audit-report.mjs` | Identical upstream helper retained/adopted |
| `npm-registry.mjs` | Identical upstream helper retained/adopted |
| `package-info.mjs` | Identical upstream helper retained/adopted |
| `pr-comparison.mjs` | Identical upstream helper retained/adopted |
| `preflight-credentials.sh` | Identical upstream helper retained/adopted |
| `publish-failure-classifier.mjs` | Identical upstream helper retained/adopted |
| `publish-retry.mjs` | Identical upstream helper retained/adopted |
| `publish-to-npm.mjs` | Identical upstream helper retained/adopted |
| `push-failure-classifier.mjs` | Adapted for release attestation, project coverage or diagnostics; see PR diff |
| `push-main-with-rebase-retry.mjs` | Adapted for release attestation, project coverage or diagnostics; see PR diff |
| `read-job-cancel-in-progress.sh` | Identical upstream helper retained/adopted |
| `recheck-broken-links.mjs` | Identical upstream helper retained/adopted |
| `release-metadata.mjs` | Identical upstream helper retained/adopted |
| `release-naming.mjs` | Identical upstream helper retained/adopted |
| `rerun-unacquired.mjs` | Identical upstream helper retained/adopted |
| `run-command.mjs` | Identical upstream helper retained/adopted |
| `run-with-budget-warning.sh` | Identical upstream helper retained/adopted |
| `sanitize-npm-userconfig.mjs` | Identical upstream helper retained/adopted |
| `setup-npm.mjs` | Identical upstream helper retained/adopted |
| `simulate-fresh-merge.sh` | Identical upstream helper retained/adopted |
| `smoke-test-package.mjs` | Identical upstream helper retained/adopted |
| `update-preview-images.mjs` | Identical upstream helper retained/adopted |
| `use-module.mjs` | Identical upstream helper retained/adopted |
| `validate-changeset.mjs` | Identical upstream helper retained/adopted |
| `version-and-commit.mjs` | Adapted for release attestation, project coverage or diagnostics; see PR diff |
| `version-lock.mjs` | Identical upstream helper retained/adopted |
| `wait-for-npm.mjs` | Identical upstream helper retained/adopted |

## Python pipeline review

The complete Python tree is preserved, including application and documentation files rather than only workflows. The following script-level review records where its practices apply; native Python code is not copied into an npm-only release pipeline.

| File | Applicability |
| --- | --- |
| `.github/workflows/docs.yml` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `.github/workflows/links.yml` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `.github/workflows/release.yml` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `.github/workflows/security.yml` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `.github/workflows/workflows.yml` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/__pycache__/version_and_commit.cpython-315.pyc` | Reproduced shared transient-push classification gap; upstream issue 136 |
| `scripts/audit-npm-locks.sh` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/audit_dependencies.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/bump_version.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/check-dependency-graph.sh` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/check-pipeline-status.sh` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/check-required-docs.sh` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/check_codeql_results.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/check_file_size.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/check_release.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/check_web_archive.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/create_github_release.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/create_manual_changeset.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/detect_code_changes.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/format_release_notes.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/preflight-credentials.sh` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/publish_to_pypi.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/read-job-cancel-in-progress.sh` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/read_manifest.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/recheck_broken_links.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/release_naming.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/run-with-budget-warning.sh` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/simulate-fresh-merge.sh` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/smoke_test_published_package.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/validate_changeset.py` | Compare shared status/concurrency/security/release practices; retain language-appropriate JS implementation |
| `scripts/version_and_commit.py` | Reproduced shared transient-push classification gap; upstream issue 136 |

## Upstream context

Recent merged PRs were collected in `js-merged-prs.json` and `python-merged-prs.json`. In particular JS PRs 282, 276 and 274 already address Pages retry/audit visibility, deprecations/install policies, and evidence/lock integrity. Reusing those implementations and tests avoids inventing competing adapters. New downstream discoveries are reported at JS issue 283 and Python issue 136.

## Best-practice coverage

| Principle | Applied evidence |
| --- | --- |
| 1 | Relevant-change gates and safe skipped-needs/manual dispatch |
| 2 | 1500-line limit, historical evidence exceptions |
| 3 | Prettier and staged formatting; no swallowed formatting failures |
| 4 | Full-tree warning-fatal ESLint and pinned analyzers |
| 5 | Syntax/changeset/lint before expensive runtime jobs; preflight parallel |
| 6 | One required changeset; no manual product version bump |
| 7 | Fresh-merge simulation for code, lint, corpus and docs checks |
| 8 | Husky verified installation; lint-staged explicit root configuration and ShellCheck |
| 9 | OIDC, immutable release dependency graph, metadata attestation, registry and GitHub reconciliation |
| 10 | Cancellable read-only jobs; noncancellable queued main writers |
| 11 | Pinned secrets scan before dependency lifecycle execution |
| 12 | Required docs validation and recursive file-size gate |
| 13 | Existing native amd64/arm64 Docker jobs retained |
| 14 | Actionlint, regular and high-confidence pedantic zizmor, standalone ShellCheck |
| 15 | Every lockfile audited; findings annotated and preserved |
| 16 | Release credentials preflight before builds, unknown is not success |
| 17 | Explicit status/evidence gates, cancellation reconciliation and bounded infrastructure recovery |
