# Execution plan

1. Read issue #1, all issue comments, and all three PR discussion/review endpoints; verify the prepared branch and contributing rules.
2. Inventory all repositories in the four requested owners with pagination. Search indexed code across owners; inspect relevant source and recent related PRs. Preserve source URLs and blob hashes without copying private values or raw incident logs.
3. Compare primary documentation for open source credential/PII scanners and proprietary services. Map every issue requirement to an implementation, test, or explicit evidence limit.
4. Write failing minimum examples for credential, personal-data, public-policy, Unicode, encoded, overlapping, and scanner-failure cases.
5. Implement a deterministic detector union, complete masking, metadata-only findings, audited public policy, bounded decoding, and required Secretlint integration. Add interoperable detector/report adapters and Unicode offset conversion.
6. Implement a CLI for UTF-8 files, stdin, directory scanning, config, safe atomic output, and read-only Git-history auditing. Refuse incomplete scans and never publish partially processed input.
7. Add synthetic multilingual/provider/false-positive fixtures, CLI integration tests, reusable examples and bounded experiments. Preserve existing template APIs and examples.
8. Configure real package metadata and a changeset release trigger. Document APIs, detector/language coverage, integration instructions, security assumptions, and optional history remediation.
9. Run all local tests and contributing checks, review errors from saved logs, fix root causes, commit useful atomic steps, and merge the latest default branch before pushing only the prepared branch.
10. Update PR #2 with reproduction, tests, research, and limitations. List CI runs with timestamps/SHAs, preserve every failing run's logs under `ci-logs/`, analyze errors by line, and recheck after fixes. Review the final PR diff and clean working tree; mark PR ready after all applicable checks pass.

Research started 2026-10-07. GitHub code search is indexed and capped; repository inventory is complete for accessible repositories, while code coverage is explicitly qualified in the study. No comparative superiority claim is made without a reproducible benchmark.
