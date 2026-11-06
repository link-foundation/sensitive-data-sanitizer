# Issue 102 / PR 103 evidence

[Pull request 103](https://github.com/link-foundation/sensitive-data-sanitizer/pull/103) implements the dependency updates and repairs the CI failures introduced by merged Dependabot PRs 97–99. Research and registry snapshots were collected on 2026-11-05–06 UTC.

## Review map

- [PLAN.md](PLAN.md): every requirement, candidate approach, implementation and verification status.
- [ANALYSIS.md](ANALYSIS.md): root causes, alternatives, existing components, migration reviews, compatibility exceptions and retained upstream workarounds.
- [VALIDATION.md](VALIDATION.md): reproductions, focused tests, CI run/SHA evidence, audits and limits.
- [dependencies/](dependencies/): complete before / registry-latest / resolved inventories; each retained version has a reason and registry/source link.
- [upstream/reports.json](upstream/reports.json): eleven posted reports/comments, with the exact report bodies in that directory.
- [research/](research/): full issue/comment/PR snapshots, recent related work, release/registry metadata, upstream search results and source excerpts.
- [ci-logs/](ci-logs/): preserved complete failing-run logs, selected failing-job logs and the successful real Python scanner job.
- [verification/](verification/): local commands' captured output, including failed intermediate experiments and subsequent successful checks.

## Complete dependency inventories

| Inventory | Occurrences | Unique names | Files |
| --- | ---: | ---: | --- |
| Root npm graph | 322 | 281 | [table](dependencies/npm-root.md), [CSV](dependencies/npm-root.csv) |
| Example npm graph | 379 | 313 | [table](dependencies/npm-example.md), [CSV](dependencies/npm-example.csv) |
| Artifact transport npm graph | 226 | 210 | [table](dependencies/npm-artifact.md), [CSV](dependencies/npm-artifact.csv) |
| Deno graph | 311 | 290 | [table](dependencies/deno.md), [CSV](dependencies/deno.csv) |
| Python benchmark | 69 | 69 | [table](dependencies/python-benchmark.md), [CSV](dependencies/python-benchmark.csv) |
| Python development/audit environment | 36 | 36 | [table](dependencies/python-tooling.md), [CSV](dependencies/python-tooling.csv) |
| External GitHub Actions | 67 | 20 | [table](dependencies/github-actions.md), [CSV](dependencies/github-actions.csv) |
| Toolchains, images, model and local adapter | 21 | 21 | [table](dependencies/toolchains-and-images.md), [CSV](dependencies/toolchains-and-images.csv) |

Counts include removed or hoisted baseline locations so no old dependency silently disappears from review. The CSVs include the exact location and constraining consumer. Python tooling is the audited development environment, including the host pipx launcher; runner-provided OS packages are managed by the hosted runner, rather than repository dependency manifests.

## Evidence interpretation

Files are snapshots, not live status endpoints. A failed draft run is retained as diagnosis evidence and does not describe a later corrected commit. See the SHA and timestamps in `research/runs-*.json` and the final PR checks. Negative experiments are preserved and identified as negative; they are not proof of an upstream bug. Logs may contain ANSI escapes and synthetic test inputs. Empty successful lint/cache outputs are expected for quiet tools; see [research/FORMATS.md](research/FORMATS.md) for JSON versus newline-delimited JSON snapshots and unsuccessful searches.

Historical benchmark reports and imported case-study data retain the versions actually tested. Active requirements, tooling, instructions and CI pins are updated. Python 3.15 and Java 27 compatibility exceptions are explicit in the inventory and analysis.

The original issue's literal requirement for a green new run on main remains pending the normal PR merge. This work does not merge the PR or write directly to main.
