# Complete template and best-practice review

The comparison uses the full immutable repository trees, not selected workflow snippets:

| Template | Revision | Template blobs | Baseline comparison states |
| --- | --- | --- | --- |
| JavaScript | `7877a27980664bc6453e80262f8391d1c2562ab1` | 532 | 187 identical; 62 different; 283 template only; 280 local only |
| Python | `78f2fdf5e085871387555bc066071f0aedd24479` | 155 | 2 identical; 18 different; 135 template only; 509 local only |

`templates/*-tree.json` records the full recursive GitHub trees; `*.tar.gz` retains all source bytes, including action bundles and lockfiles. `*-comparison.json` inventories **every path in the union** with this repository at the investigation baseline, excluding immutable historical evidence. These inventories intentionally retain their pre-fix state. `*-ci.diff` retains all differing workflow/action/script text; JSON and generated dist bytes are compared by the full archives/inventory rather than rendered as a huge textual diff. `python-shell.diff` is the focused comparison of all eight shared shell helpers. All CI paths have an individual disposition in `TEMPLATE-PATHS.md`.

## Related recent work reviewed

The paginated recent-PR metadata in `templates/` includes the latest JS repairs (#282 Pages/schedules/unacquired jobs, #276 security, #274 releases, #263 pinning, #255 status gates) and Python repairs (#134 Pages/schedules/auditing, #129 glob coverage, #127 artifact transport, #119 workflow safeguards, #103 zizmor). Local PR 93 already incorporates related publication-race, dependency-lock, retry and scheduled-audit safeguards. These stronger local implementations are retained; copying an older generic template over them would regress behavior.

## Workflow comparison and decisions

| Area / all template workflows | Decision and reason |
| --- | --- |
| JS `example-app.yml` | Shared actual missing-CLI defect repaired locally and reported upstream as JS issue 285. Preserve native desktop packaging, Pages opt-in, pinned image/OS versions and existing screenshot generation; add same-image read-only PR environment check before the main writer. |
| JS/Python `release.yml` | Keep actual merge-result validation, fast gates, complete runtime/OS shards, version-only release attestation, credential preflight, trusted publishing, installed-package smoke, strict remote verification and bounded retries. Python's PyPI publishing, wheel/sdist build and scriv metadata do not apply to this npm package. |
| JS/Python `security.yml` | Keep independent CodeQL, dependency review and graph probe plus all-lock npm audits and scheduled fixable-advisory policy. Add Python CodeQL and resolved requirements auditing; no absent Python-language dependency coverage remains. |
| JS/Python `workflows.yml` | Existing digest-pinned actionlint, ShellCheck, zizmor regular plus high-severity pedantic, status-gate coverage, and real artifact roundtrip are retained. Add pinned Ruff check/format for every maintained Python helper, matching local precommit. |
| JS/Python `links.yml` | Keep pinned Lychee with archive/reference and strict transport-aware recheck; existing required-doc checks and source exclusions apply to this repository. |
| JS/Python `rerun-unacquired.yml` | Existing bounded, failed-run-only recovery preserves ordinary success/skipped behavior. Local condition also handles repository-specific release behavior; retain tested implementation. |
| JS `javascript-first-example.yml`, `javascript-first-gate.yml` | These reusable/template demonstration workflows orchestrate foreign projects. This repository already owns a complete JS-first release workflow and does not call them. Copying sample entry points would create duplicate gates/publication flows. |
| Python `docs.yml` | Builds and publishes that Python package's Sphinx site. This project ships Markdown/API docs and a universal app with its own Pages gate; retain actual docs/link/app checks. Do not add an unrelated Sphinx package/site. |
| Generated graph-update workflow cited by issue | Platform-generated dependency-graph job, absent from both checked-in workflow trees. Preserve its successful historical log and independently audit requirements here; all editable runner labels are pinned. |

## CI scripts, actions, and configuration

Identical JS scripts are byte-proven in the inventory and reused as-is. Differing shared files were read in their complete CI diff; each local difference below is intentional or repaired by this PR.

- Artifact transport package manifests/locks retain local advisory fixes. JS source action helpers match the template; local real SDK archive/byte roundtrip tests provide stronger evidence. Python's equivalent action commits a generated SDK bundle plus Python extractor; copying it would duplicate a working action and reintroduce bundle synchronization maintenance. Keep the local locked runtime SDK and safe extractor.
- Python deploy-Pages composite is equivalent in purpose to local `deploy-pages.mjs` plus the universal-app job. Keep the existing opt-in deployment policy and bounded retries, including actionable main failure when setup is required.
- CodeQL configuration retains historical evidence/experiment exclusions and scans shipped examples. Python is now included in the actual analysis matrix.
- `check-file-line-limits.sh` retains this repository's established 1,500-line limit, tracked-file walk, empty-walk failure, and historical evidence exclusions; adds `.py` to existing JavaScript/Markdown/YAML scopes.
- `npm-audit-report.mjs` preserves the PR high-severity gate and weekly fixable-moderate gate, with annotations for every advisory and fail-closed malformed results. The local lockfiles already contain fixes from PR 93; do not replace them with template versions.
- `publish-to-npm.mjs`, `release-metadata.mjs`, `version-and-commit.mjs`, and `version-lock.mjs` retain stronger source/dependency attestation across retries and recovery. Local `release-publication.mjs` prevents unvalidated remote code from entering publication. Generic template recovery is weaker.
- `push-failure-classifier.mjs` and `push-main-with-rebase-retry.mjs` retain PR 93's bounded retries for transient internal commit-ref rules, while permanent policy rejection fails. Release metadata is revalidated before each push; publication never falls back to an unattended release PR. Screenshot recovery remains available.
- All seven differently implemented shared Python shell helpers were compared: dependency-graph probing, pipeline status, required docs, credential preflight, cancellation-policy reading, budget warnings, and merge simulation, including both status and cancellation helpers in the inventory. Preserve JavaScript interfaces, JSON parsing, Bash 3.2/macOS compatibility, strict cancellation reporting, exact simulated merge and existing process budgets rather than adopting Python-package assumptions.
- `.github/zizmor.yml` retains narrow local-action compatibility exceptions and hash-pin policy. `actionlint.yaml` from Python configures its own shell-check context; this repo runs the digest-pinned Docker image with bundled shellcheck/pyflakes and one documented ignore for supported GitHub `queue:max` syntax. No broad warning suppression is added.
- Adopt Python's weekly grouped dependency-update configuration with a seven-day version cooldown, adapted to the actual three npm directories and benchmark requirements plus Actions. The scope regression test prevents a new tracked manifest escaping update coverage.

### Every Python-specific script mapped to this repository

| Python template script | Equivalent / implemented decision |
| --- | --- |
| `audit_dependencies.py` | New `audit-python-dependencies.py`: all tracked requirements, hashed transitive resolution, fail-closed unsupported manifests, uv/no-build and pip-audit without large installs |
| `audit-npm-locks.sh` | Existing security matrix and `npm-audit-report.mjs` audit all three locks |
| `bump_version.py`, `version_and_commit.py` | Existing `instant-version-bump.mjs`, `version-and-commit.mjs`, changeset/lock attestation |
| `check_codeql_results.py` | Existing `check-codeql-results.mjs` enforces actual SARIF results rather than trusting action success |
| `check_file_size.py` | Existing tracked-file limit script extended to Python and covered by real oversize fixture |
| `check_release.py` | `check-release-needed.mjs`, `npm-registry.mjs`, `wait-for-npm.mjs` exact publication proof |
| `check_web_archive.py` | Existing `check-web-archive.mjs` strict archive classification |
| `create_github_release.py` | Existing `create-github-release.mjs` validates notes/artifacts and release status |
| `create_manual_changeset.py` | Existing `create-manual-changeset.mjs` and dispatch path |
| `detect_code_changes.py` | Existing `detect-code-changes.mjs`; explicit `.py` workflow trigger added |
| `format_release_notes.py` | Existing `format-release-notes.mjs` plus helpers, fence-aware formatting and API-error propagation |
| `publish_to_pypi.py` | No PyPI artifact is published here; trusted npm publishing is the applicable implementation |
| `read_manifest.py` | Existing `package-info.mjs`, `js-paths.mjs` read the actual npm package metadata |
| `recheck_broken_links.py` | Existing `recheck-broken-links.mjs` distinguishes missing resources from transport/service errors |
| `release_naming.py` | Existing `release-naming.mjs` handles npm naming/monorepo tags |
| `smoke_test_published_package.py` | Existing `smoke-test-package.mjs` installs the actual npm package and exercises API/CLI |
| `validate_changeset.py` | Existing `validate-changeset.mjs` validates merge-base changes and metadata rather than trusting a renamed file |

Other tree files were compared, not imported wholesale: template sample products, multilingual READMEs, fixtures, language translations and package-specific source/tests are not this sanitizer's implementation. Shared lint/format/hook/release configuration is adapted to the actual language/package layout. Existing local domain-specific tests, vendored detectors and app assets remain intact. Python template's package-focused strict mypy target is not copied over JavaScript `src/`; Ruff and CodeQL cover the small untyped Python helper surfaces without adding a fictitious Python package or installing NLP models.

## Referenced best-practices applicability matrix

All seventeen principles in the retained `templates/CI-CD-BEST-PRACTICES.md` were reviewed.

| # | Principle | Applied verification / applicability |
| --- | --- | --- |
| 1 | Relevant-change triggers | Existing source/manifest/CI detection; both Example app filters now include complete helper dependency paths, Python workflow triggers include Python/config changes. Evidence/docs excluded from production lint. |
| 2 | File size | Shared 1,500-line gate includes Python; JS ESLint function/file limits retained; real oversize regression. |
| 3 | Formatting | ESLint/Prettier retained; pinned Ruff added and all maintained Python formatted. |
| 4 | Static analysis | Strict JS/TS lint/type checks; ShellCheck; Ruff; CodeQL JS/Actions/Python. Package-oriented mypy target not applicable to JS source layout. |
| 5 | Fast fail | Existing fast gates precede matrix/build/publish; new tool preflight precedes expensive screenshot regeneration. |
| 6 | Changeset versioning | Existing automated semantic version/changelog pipeline; patch changeset supplied. |
| 7 | Actual merge result | Existing `simulate-fresh-merge.sh`, exact validated source, release attestation preserved; no untested pull during publication. |
| 8 | Precommit | Existing staged JS/Markdown/shell formatting/lint hooks plus pinned Ruff for Python. |
| 9 | Release automation | Existing npm/GitHub release, publication smoke and retry/attestation retained. No unrelated PyPI release created. |
| 10 | Concurrency | Cancellable check groups, shared serialized main-writer queue, no cancellation of active publish. Existing queue:max is supported platform syntax. |
| 11 | Secret detection | Existing secretlint and repository credentials checks remain; real preview credential fixture uses dummy token and isolated config without logging credentials. |
| 12 | Documentation | Required docs, Markdown formatting, broken-link and archive validation retained; investigation/evidence linked from PR. |
| 13 | Native container architectures | Existing native desktop/OS matrix retained; preview image is intentionally Linux x64 with explicit platform check. No new multiarch image product is requested. |
| 14 | Workflow lint | Pinned actionlint, ShellCheck, zizmor and complete terminal-gate coverage retained; new jobs included. |
| 15 | Dependency tree audit | Three npm locks audited; resolved Python transitive audit added; weekly Dependabot covers all actual manifests. |
| 16 | Publication preflight | Existing credential/registry preflight retained; actual gh/Git credential check now runs before expensive preview generation. |
| 17 | Pipeline vs changed world | Preserve transport-aware link/API checks, scheduled advisory policy and fail-closed unknown responses. Classify historical platform notice and expected fixture strings instead of hiding warnings. |

## Verification limits

A PR cannot safely prove main-branch publication by writing to main or npm. The same-image real PR smoke proves the missing-tool and credential-helper fix; existing writer/publish regression suites verify write/recovery behavior. The final PR CI checks verify full builds and matrices without unauthorized default-branch writes. Immutable historical logs remain historical; they are not rewritten as green.
