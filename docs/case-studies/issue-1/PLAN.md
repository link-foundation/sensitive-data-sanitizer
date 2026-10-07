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

## Review follow-up execution checklist

- [x] Read the complete requirements review, issue, updated description and all comment endpoints; confirm branch and clean starting tree. Latest five CI runs all succeeded for starting SHA `60cdd96` after its commit.
- [x] Add every review input to reproducible default-engine regression fixtures; record failures before implementation.
- [x] Fix complete credential spans with context-aware quoted, line, query and shell value boundaries.
- [x] Expand credential vocabulary, 17-language prose/inflection and known command password flags.
- [x] Add default multilingual free-text names, national phones, postal addresses, IBAN, contextual national IDs, MACs, handles and home-path usernames; normalize non-Latin digits with original offsets.
- [x] Add evidence-backed built-in public entity/contact/IP knowledge, manual overrides and opt-in verification.
- [x] Vendor pinned MIT Gitleaks rules with reproducible sync/provenance; add entropy and missing provider recognizers.
- [x] Build a labelled synthetic corpus and run independently pinned Gitleaks, TruffleHog, detect-secrets, Presidio and scrubadub comparisons; publish full-span metrics and iterate on misses.
- [x] Implement typed confidence/likelihood and common transforms with keyed deterministic pseudonyms, partial masking, date shifts and bucketing; test disclosure and credential-priority behavior.
- [x] Carry over HTML/byte decoding, encoded structure preservation, compatible masking, opt-in local GitHub credentials, bounded streaming/workers, outbound helpers and ESLint boundary rule.
- [x] Implement fresh-clone Git-history preview/rewrite including blob/message/identity redaction and post-rewrite audit without remote pushes; retain reproducible disposable-repo tests.
- [x] Move template API/bin/docs into explicit legacy namespaces and update affected packaging/example tests.
- [x] Extend language-specific fixtures, API/declaration docs, research/coverage tables and release Changeset.
- [x] Run all Node/Bun/Deno tests and local CI checks with saved logs; bound stress probes by finite input and heap/stack limits.
      Final publication: review the complete diff, confirm current default-branch ancestry, commit atomic passing steps and push only `issue-1-b188f503edf3`.
      Live completion is tracked in PR #2: rewrite its description around delivered behavior and measured evidence, check latest-SHA CI timestamps, download/analyze failures, fix and recheck, then mark ready with a clean working tree.

No market-wide or proprietary-model guarantee can be proven from finite tests. The follow-up must deliver concrete functionality and measurements, and distinguish corpus results from universal recall instead of treating documentation alone as delivery.
