# Issue 92 / pull request 93 evidence

- [Analysis and timeline](ANALYSIS.md): 29 findings, observed causes, chosen solutions, alternatives and evidence limits.
- [Requirements and verification](VERIFICATION.md): complete issue/task inventory, before/after checks, exact CI revisions and final conclusions.
- [Plan](PLAN.md): tracked acceptance checklist.
- [Template comparison](research/TEMPLATE-COMPARISON.md): both complete trees, every shared CI helper, deliberate product differences and all 17 best practices.
- `github/`: complete issue/review/sub-issue responses, run/job metadata, scanning alerts, repository settings and PR file inventory.
- `ci-logs/run-*.log.gz`: complete workflow logs, streamed and compressed to bound local memory and disk use. `ci-evidence-index.json` maps runs to SHAs, conclusions, job results, annotation line numbers and dependency/LF warnings.
- The superseded, cancelled run 42074652518 has no log for an unstarted job, so `gh run view --log` cannot aggregate it. The raw Actions `run-42074652518.archive.zip` preserves all 246 available job/step logs; its root job logs are indexed with member-specific line numbers. The CLI error is preserved too.
- `research/`: complete template archives and recursive trees, SHA-256 comparisons, primary-source research, SARIF and upstream reports with reproducible examples/workarounds/code suggestions.
- Top-level regression logs: before/after results for the captured push failure, all five regex paths, publication races, malformed audit evidence Windows Bun/Deno partitioning and expensive macOS Deno fixture isolation. Full historical logs and large diffs use gzip; line references refer to decompressed text.

Rebuild the CI index without network access:

```sh
python experiments/issue-92/summarize-ci-evidence.py
```

Recompare the current committed tree with the preserved template snapshots:

```sh
python experiments/issue-92/compare-template-trees.py
```

Compare measured per-file execution costs without rerunning any tests:

```sh
python experiments/issue-92/measure-ci-test-files.py macos-26-intel deno 42072807448 42074842186 42076521762
```

The implementation evidence snapshot covers every workflow through the final code revision. Checks on the subsequent evidence-only commit are linked from PR #93; saving a commit’s own completed logs inside that same commit is necessarily impossible. Those final logs are also downloaded into this local folder.

The tree comparison records its exact local commit in `research/inventory-revisions.json`; rerunning it on an evidence-only commit naturally changes the local evidence inventory. It never runs a build or downloads dependencies.

To inspect a specific workflow section, decompress the log and read a bounded range of at most 1,500 lines. Historical failed, cancelled, superseded and warning-bearing runs are retained; they are not presented as final verification.
