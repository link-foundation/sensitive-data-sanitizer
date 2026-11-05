# Individual template CI path dispositions

Comparison states are from the pre-fix baseline. Semantic decisions and translated Python counterparts are detailed in TEMPLATE-REVIEW.md. All other product/docs/test paths remain listed in the complete comparison JSON.

## Javascript template

| Path | Baseline state | Review disposition |
| --- | --- | --- |
| `.github/actions/artifact-transport/README.md` | identical | Byte-identical reusable implementation; retained. |
| `.github/actions/artifact-transport/action.yml` | identical | Byte-identical reusable implementation; retained. |
| `.github/actions/artifact-transport/extract.mjs` | identical | Byte-identical reusable implementation; retained. |
| `.github/actions/artifact-transport/index.mjs` | identical | Byte-identical reusable implementation; retained. |
| `.github/actions/artifact-transport/package-lock.json` | different | Complete archive/bytes compared; retain local locked artifact transport and security fixes. |
| `.github/actions/artifact-transport/package.json` | different | Complete archive/bytes compared; retain local locked artifact transport and security fixes. |
| `.github/actions/artifact-transport/run/action.yml` | identical | Byte-identical reusable implementation; retained. |
| `.github/actions/publish-dockerhub/action.yml` | identical | Byte-identical reusable implementation; retained. |
| `.github/actions/setup-buildx-resilient/action.yml` | identical | Byte-identical reusable implementation; retained. |
| `.github/codeql/codeql-config.yml` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `.github/workflows/example-app.yml` | different | Shared gh defect fixed and reported upstream; PR environment gate and complete triggers added. |
| `.github/workflows/javascript-first-example.yml` | template only | Reusable demonstration entry point; existing local pipeline supplies actual gates. |
| `.github/workflows/javascript-first-gate.yml` | template only | Reusable demonstration entry point; existing local pipeline supplies actual gates. |
| `.github/workflows/links.yml` | identical | Byte-identical reusable implementation; retained. |
| `.github/workflows/release.yml` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `.github/workflows/rerun-unacquired.yml` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `.github/workflows/security.yml` | different | Existing fail-closed security gates retained; Python coverage and requirements audit added. |
| `.github/workflows/workflows.yml` | identical | Byte-identical reusable implementation; retained. |
| `.github/zizmor.yml` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/artifact-files.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/artifact-transport.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/bootstrap-dependencies.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/changeset-version.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-artifact-archive.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-changesets.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-ci-workflows.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-codeql-results.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-dependency-graph.sh` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-desktop-compat.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-docker-build.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-docker-publish.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-file-line-limits.sh` | different | Preserve local scope/limit/data exclusions; add Python and real oversize regression. |
| `scripts/check-javascript-syntax.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-mjs-syntax.sh` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-package-manager.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-pages.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-pages.sh` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-pipeline-status.sh` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-release-needed.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-required-docs.sh` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-staged-formatting.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-status-gate-covers-all-jobs.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-version.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/check-web-archive.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/create-github-release.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/create-manual-changeset.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/debug-print.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/deploy-pages.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/detect-code-changes.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/format-github-release.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/format-release-notes-helpers.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/format-release-notes.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/github-actions-log.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/github-api-evidence.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/github-api.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/github-release-state.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/install-git-hooks.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/instant-version-bump.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/js-paths.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/land-via-pull-request.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/lint-changed-lines.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/lint.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/lychee-report.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/markdown-lines.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/merge-changesets.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/npm-audit-report.mjs` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/npm-registry.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/package-info.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/pr-comparison.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/preflight-credentials.sh` | identical | Byte-identical reusable implementation; retained. |
| `scripts/publish-failure-classifier.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/publish-retry.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/publish-to-npm.mjs` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/push-failure-classifier.mjs` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/push-main-with-rebase-retry.mjs` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/read-job-cancel-in-progress.sh` | identical | Byte-identical reusable implementation; retained. |
| `scripts/recheck-broken-links.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/release-metadata.mjs` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/release-naming.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/release-publication.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/rerun-unacquired.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/run-command.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/run-test-shard.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/run-with-budget-warning.sh` | identical | Byte-identical reusable implementation; retained. |
| `scripts/sanitize-npm-userconfig.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/setup-npm.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/simulate-fresh-merge.sh` | identical | Byte-identical reusable implementation; retained. |
| `scripts/smoke-test-package.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/sync-entity-catalogs.py` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/sync-gitleaks.py` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/update-preview-images.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/use-module.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/validate-changeset.mjs` | identical | Byte-identical reusable implementation; retained. |
| `scripts/version-and-commit.mjs` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/version-lock.mjs` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/wait-for-npm.mjs` | identical | Byte-identical reusable implementation; retained. |

## Python template

| Path | Baseline state | Review disposition |
| --- | --- | --- |
| `.github/actionlint.yaml` | template only | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `.github/actions/artifact-transport/README.md` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `.github/actions/artifact-transport/action.yml` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `.github/actions/artifact-transport/extract.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `.github/actions/artifact-transport/index.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `.github/actions/artifact-transport/package-lock.json` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `.github/actions/artifact-transport/package.json` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `.github/actions/artifact-transport/run/action.yml` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `.github/actions/artifact/action.yml` | template only | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `.github/actions/artifact/dist/835.index.mjs` | template only | Complete archive/bytes compared; retain local locked artifact transport and security fixes. |
| `.github/actions/artifact/dist/extract.py` | template only | Complete archive/bytes compared; retain local locked artifact transport and security fixes. |
| `.github/actions/artifact/dist/index.mjs` | template only | Complete archive/bytes compared; retain local locked artifact transport and security fixes. |
| `.github/actions/artifact/dist/licenses.txt` | template only | Complete archive/bytes compared; retain local locked artifact transport and security fixes. |
| `.github/actions/artifact/extract.py` | template only | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `.github/actions/artifact/files.mjs` | template only | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `.github/actions/artifact/index.mjs` | template only | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `.github/actions/artifact/package-lock.json` | template only | Complete archive/bytes compared; retain local locked artifact transport and security fixes. |
| `.github/actions/artifact/package.json` | template only | Complete archive/bytes compared; retain local locked artifact transport and security fixes. |
| `.github/actions/artifact/transport.mjs` | template only | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `.github/actions/deploy-pages/action.yml` | template only | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `.github/actions/deploy-pages/deploy.mjs` | template only | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `.github/actions/deploy-pages/index.mjs` | template only | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `.github/actions/publish-dockerhub/action.yml` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `.github/actions/setup-buildx-resilient/action.yml` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `.github/codeql/codeql-config.yml` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `.github/dependabot.yml` | template only | Adopted weekly grouped policy for actual local manifests. |
| `.github/workflows/docs.yml` | template only | Python Sphinx product site; use local Markdown/API/app documentation checks. |
| `.github/workflows/example-app.yml` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `.github/workflows/links.yml` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `.github/workflows/release.yml` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `.github/workflows/rerun-unacquired.yml` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `.github/workflows/security.yml` | different | Existing fail-closed security gates retained; Python coverage and requirements audit added. |
| `.github/workflows/workflows.yml` | different | Existing workflow gates retained; add pinned Python static checks. |
| `.github/zizmor.yml` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/artifact-files.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/artifact-transport.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/audit-npm-locks.sh` | template only | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/audit_dependencies.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/bootstrap-dependencies.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/bump_version.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/changeset-version.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-artifact-archive.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-changesets.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-ci-workflows.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-codeql-results.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-dependency-graph.sh` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/check-desktop-compat.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-docker-build.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-docker-publish.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-file-line-limits.sh` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-javascript-syntax.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-mjs-syntax.sh` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-package-manager.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-pages.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-pages.sh` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-pipeline-status.sh` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/check-release-needed.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-required-docs.sh` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/check-staged-formatting.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-status-gate-covers-all-jobs.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-version.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check-web-archive.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/check_codeql_results.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/check_file_size.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/check_release.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/check_web_archive.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/create-github-release.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/create-manual-changeset.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/create_github_release.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/create_manual_changeset.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/debug-print.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/deploy-pages.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/detect-code-changes.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/detect_code_changes.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/format-github-release.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/format-release-notes-helpers.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/format-release-notes.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/format_release_notes.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/github-actions-log.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/github-api-evidence.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/github-api.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/github-release-state.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/install-git-hooks.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/instant-version-bump.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/js-paths.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/land-via-pull-request.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/lint-changed-lines.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/lint.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/lychee-report.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/markdown-lines.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/merge-changesets.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/npm-audit-report.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/npm-registry.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/package-info.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/pr-comparison.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/preflight-credentials.sh` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/publish-failure-classifier.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/publish-retry.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/publish-to-npm.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/publish_to_pypi.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/push-failure-classifier.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/push-main-with-rebase-retry.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/read-job-cancel-in-progress.sh` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/read_manifest.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/recheck-broken-links.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/recheck_broken_links.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/release-metadata.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/release-naming.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/release-publication.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/release_naming.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/rerun-unacquired.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/run-command.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/run-test-shard.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/run-with-budget-warning.sh` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/sanitize-npm-userconfig.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/setup-npm.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/simulate-fresh-merge.sh` | different | Complete differing source reviewed; preserve local equivalent/safeguard as detailed in TEMPLATE-REVIEW.md. |
| `scripts/smoke-test-package.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/smoke_test_published_package.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/sync-entity-catalogs.py` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/sync-gitleaks.py` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/update-preview-images.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/use-module.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/validate-changeset.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/validate_changeset.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/version-and-commit.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/version-lock.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |
| `scripts/version_and_commit.py` | template only | Translated counterpart explicitly mapped in TEMPLATE-REVIEW.md; package-only behavior marked inapplicable. |
| `scripts/wait-for-npm.mjs` | local only | Repository-specific safeguard/helper; retained and included in local checks. |

