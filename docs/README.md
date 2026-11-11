# Documentation

[Project overview and quick start](../README.md)

## Start here

- [Use cases and workflow choices](USE-CASES.md): when to use each entry, profile and integration.
- [API reference](API.md): options, findings, transformations, streaming and extension contracts.
- [Coverage and limits](COVERAGE.md): supported formats, languages, performance and failure behavior.
- [Best practices](BEST-PRACTICES.md): publication and operational guidance.
- [Rules](RULES.md): rule families and custom policy controls.
- [Optional credential verification](VERIFICATION.md): explicit network opt-in, providers and outcome meanings.
- [Git history remediation](HISTORY-REMEDIATION.md): auditing and rewriting repository history.

## Compare and evaluate

[Comparison overview](COMPARISON.md) links the detailed comparisons for
[secrets](comparison/secrets-detection.md), [personal data](comparison/pii-detection.md),
[transformations](comparison/transformations.md), [decoding](comparison/decoding-and-encodings.md),
[suppression](comparison/suppression-and-allow-lists.md), [reporting and CI](comparison/reporting-and-ci.md),
[extensibility](comparison/extensibility.md), [deployment](comparison/deployment.md)
and [measured results](comparison/measured-results.md).

[All case studies](case-studies/README.md) indexes the historical investigations,
requirement inventories, research and validation records. [Issue 146](case-studies/issue-146/README.md)
records the latest audit and unresolved criteria explicitly. Benchmark and
research numbers apply only to their stated versions and configurations.

## Build and contribute

- [Contributing](CONTRIBUTING.md): development setup, checks and changesets.
- [Examples](../examples/): runnable library and CLI integrations.
- [Template pipeline](TEMPLATE-PIPELINE.md): inherited packaging and CI architecture.
- [Changelog](../CHANGELOG.md) and [license](../LICENSE).

Legacy pipeline investigations are retained for traceability:
[timeout budgets](legacy/CI-TIMEOUT-BUDGETS.md),
[release analysis](legacy/ISSUE-199-RELEASE-ANALYSIS.md) and
[pipeline analysis](legacy/ISSUE-203-ANALYSIS.md). They are historical evidence,
not current setup instructions.
