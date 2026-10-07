# Repository research and transferred practices

## Collection method and completeness

The [collection script](../../../experiments/collect-sanitization-research.mjs) enumerates accessible owned repositories with pagination, then performs separate indexed `sanit` and `redact` code searches for each owner. Snapshots retain repository metadata and source paths/URLs, not raw credential-bearing logs. Ownership filtering excludes repositories merely accessible through collaboration. Collection date: 2026-10-07.

| Owner           | Owned repositories | `sanit` matches | `redact` matches |
| --------------- | -----------------: | --------------: | ---------------: |
| link-foundation |                172 |              75 |                9 |
| linksplatform   |                 88 |              18 |                1 |
| link-assistant  |                 29 |             757 |              389 |
| konard          |              1,444 |             869 |              233 |
| Total           |              1,733 |           1,719 |              632 |

Each final query returned fewer than the 1,000-result search cap. The initial owner-combined 100-result searches are also preserved to make the expansion traceable. Repository enumeration is broader than indexed code search: GitHub's indexed/default-branch coverage, inaccessible repositories, the chosen substrings, fork/index eligibility and API collection time limit what can be concluded. An inventory entry is not evidence that every blob in that repository was inspected.

Search results include irrelevant meanings of “sanitize”: C++ AddressSanitizer in linksplatform projects, HTML sanitization in WordPress forks, and removal of deprecated npm configuration. Those are not credential-redaction algorithms. The search narrows an investigation; filenames alone do not establish a security feature. The inspected primary modules below supply the implementation evidence.

## hive-mind: publication safety and performance

Source snapshot: `56b651c9ddec153b5b6fdb052fd063cd8f2343a1`. The inspected [credential publication module](https://github.com/link-assistant/hive-mind/blob/56b651c9ddec153b5b6fdb052fd063cd8f2343a1/src/credential-sanitization-core.lib.mjs) and [token sanitization module](https://github.com/link-assistant/hive-mind/blob/56b651c9ddec153b5b6fdb052fd063cd8f2343a1/src/token-sanitization.lib.mjs) separate known-value filtering, maintained scanners, contextual token patterns and final publication verification. Exact source paths/blob URLs are retained in [the path snapshot](research/hive-mind-paths.jsonl).

Transferred practices:

- Treat detector failures as publication failures; perform a second scan of the exact final text.
- Supplement prefix/entropy rules with explicitly selected environment credentials, including short values. Do not read unrelated auth files implicitly.
- Recognize escaped/nested JSON and bounded encoded views, preserving original spans. Unicode and decoded forms must not leave fragments of a detected secret.
- Keep diagnostics free of matched text. Preserve delimiters while replacing detected values completely; the new package uses full masking rather than retaining token prefixes/suffixes.
- Bound key affixes and decoding. Avoid interpreting token counters, code keywords and ordinary tool/hash identifiers as credentials.
- Use private temporary files and publish only after successful verification.

Recent related [PR #2398](https://github.com/link-assistant/hive-mind/pull/2398) investigates non-idempotent masking of code such as `token => !token`, short known environment values and safe failure diagnostics. [PR #2401](https://github.com/link-assistant/hive-mind/pull/2401) identifies keyword false positives and retained Secretlint profiler entries during repeated publication scans. The new implementation excludes assignment arrows/language literals and explicitly disables the shared upstream profiler. Synthetic regressions exercise these behaviors; incident log contents are not copied into this repository.

hive-mind also has bounded worker/stream publication infrastructure. This package implements bounded whole-input verification, not a claim to port that infrastructure verbatim. Unrestricted fragments and streaming equivalence require additional acceptance tests before extending the supported text profile.

## formal-ai: prove that required scanners actually run

Source snapshot: `d209aac6461b355f1a527831202af3423135f7e6`. The inspected [secrets-check script](https://github.com/link-assistant/formal-ai/blob/d209aac6461b355f1a527831202af3423135f7e6/scripts/check-secrets.sh) uses pinned recommended Secretlint rules and changed-file selection. Its [related PR #809](https://github.com/link-assistant/formal-ai/pull/809) documents a full-tree scan that did not finish in 25 minutes, a 2.6-second diff scan, and a synthetic planted-token check establishing that the job actually detects secrets.

Transferred practice: test an actual upstream rule, rather than only mocking a scanner's success. The package's default Secretlint test contains an embedded disable directive and verifies detection anyway: comments inside untrusted logs cannot suppress the library's scanner union. CLI failures return a generic error and block output.

Diff-only scanning is useful for repository CI, but is insufficient to audit publication output or historical exposure. The new library scans complete bounded text; the history command scans historical objects. The [formal-ai path snapshot](research/formal-ai-paths.jsonl) also contains npm-userconfig utilities and template copies. Removing `always-auth` is configuration maintenance, not sensitive-value sanitization, and was not reused as a detector.

## documents-processing: personal variants and history safeguards

Source snapshot: `b4e32ad9e0d355409801a958ec7e10f95b45a576`. Inspected modules include [the e-visa redactor](https://github.com/konard/documents-processing/blob/b4e32ad9e0d355409801a958ec7e10f95b45a576/src/evisa-redact.mjs) and [history redactor](https://github.com/konard/documents-processing/blob/b4e32ad9e0d355409801a958ec7e10f95b45a576/src/redact-history.mjs); exact selected paths are in [the snapshot](research/documents-processing-paths.jsonl).

Personal redaction needs explicit private dictionaries and spelling variants: case, numeric separators and dates can vary independently of a service-token prefix. The new `knownPersonal` and `personalVariants()` APIs cover literal case matching and supported numeric/date spellings. Transliteration is caller-supplied; it is not guessed from a person's name.

History work needs an immutable backup, dry-run/review, separate blob/message/author handling, and post-rewrite verification of complete snapshots. Preserving approved public values requires policy and regression tests. The package provides a read-only reachable/reflog object audit, including deleted blobs and author metadata, plus a [reviewed remediation procedure](../../HISTORY-REMEDIATION.md). It never rewrites or force-pushes automatically. Unreachable objects, remote caches, forks, artifacts and filenames need separate remediation.

## router: structured request boundaries

An additional relevant implementation is [router's request-log redactor](https://github.com/link-assistant/router/blob/d7f602b8c4a920c61ceee1c8017b618cb401126e/src/request_log/redaction.rs), blob `f39e496eae017208cc15c519accbf13744c1b1cc`. It handles case-normalized sensitive headers, query parameters, known token values and recursive JSON fields, including request resource metadata and user-identifying fields. Its structured approach can preserve JSON types and mask entire sensitive metadata objects.

The new text profile handles headers, query credentials, known values and JSON/escaped-string credential context; it does not claim to reproduce router's schema-aware masking of every metadata field. Numeric replacement may change JSON syntax/types, and arbitrary metadata objects require an explicit structured adapter. Router's partial token masking and base64 fallback for non-text bodies are not adopted as evidence of complete redaction. The package fully masks detected spans and rejects binary input at its CLI boundary.

## Consolidation decisions

The common safety invariant is a verified publication boundary, not the count of regexes. Independently maintained engines extend recall; exact dictionaries cover context that heuristics cannot infer; offset validation prevents accidental under-masking; public exceptions require explicit evidence and never override credentials. Private writes and metadata-only reports reduce exposure during normal operation. Unsupported representations and ambiguous private/public context remain explicit coverage limits.

All transferred algorithms here were implemented around this package's text/offset contract; third-party source files were not copied wholesale. Runtime component provenance is recorded in [the competitor study](COMPETITORS.md).
