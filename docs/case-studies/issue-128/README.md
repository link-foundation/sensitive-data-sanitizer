# Issue 128: competitors, their test cases and feature parity

Issue: [#128](https://github.com/link-foundation/sensitive-data-sanitizer/issues/128).
Pull request: [#129](https://github.com/link-foundation/sensitive-data-sanitizer/pull/129).
The issue has no comments and no sub-issues. Its body is saved in
[`research/issue.json`](research/issue.json). The recent merged pull requests
used as style references are in
[`research/recent-merged-prs.json`](research/recent-merged-prs.json).

## Requirements

| #   | Requirement (from the issue)                                                        | Where it is met                                                                                                                                                                                                                | Verification                                                                                                                     |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Update the list of open-source and closed-source competitors                        | [`docs/COMPARISON.md`](../../COMPARISON.md) (tools compared, market changes), [issue 1 competitor list](../issue-1/COMPETITORS.md), research files below                                                                       | Every tool has a source link in the research files                                                                               |
| R2  | Take competitors' best test cases (docs when there is no source) and support them   | 853 cases in `research/*-cases.json`; detection and features in the commits listed under [Changes](#changes)                                                                                                                   | [`experiments/issue-128/probe-cases.mjs`](../../../experiments/issue-128/probe-cases.mjs); misses fell from 191 to 116 (default) |
| R3  | High-level comparison matrix                                                        | [`docs/COMPARISON.md`](../../COMPARISON.md)                                                                                                                                                                                    | Links checked by the `links.yml` workflow                                                                                        |
| R4  | Detailed per-feature comparison                                                     | Nine pages in [`docs/comparison/`](../../comparison/)                                                                                                                                                                          | Each page lists what was added and what remains                                                                                  |
| R5  | Most feature-rich and reliable: wide configuration, extensibility, replaceability   | Allow lists, inline suppression, per-type thresholds, mask options, deterministic encryption, pattern and identifier detectors, SARIF, multi-path scan, pre-commit hooks, UTF-16 files, token checksums, 203 Betterleaks rules | `tests/sanitizer-issue-128*.test.js` (4 files); [extensibility page](../../comparison/extensibility.md)                          |
| R6  | Apply code-architecture-principles fully                                            | [Architecture audit](#architecture-audit) below                                                                                                                                                                                | ESLint (complexity 15, depth 5, 1500 lines per file), jscpd, Prettier in CI                                                      |
| R7  | Case study in `docs/case-studies/issue-128` with online research and solution plans | This file and [`research/`](research/)                                                                                                                                                                                         | –                                                                                                                                |
| R8  | Everything in a single pull request                                                 | PR #129                                                                                                                                                                                                                        | –                                                                                                                                |

## Research

Four research notes were written from primary sources (repositories, test
files and vendor documentation) on 2026-11-10:

- [`research/open-source-secrets.md`](research/open-source-secrets.md):
  Gitleaks, Betterleaks, TruffleHog, detect-secrets, Secretlint, Kingfisher,
  Titus, ripsecrets, whispers, Talisman, Trivy, noseyparker and others.
  Section 3 is a feature matrix and section 6 lists recommendations.
- [`research/open-source-pii.md`](research/open-source-pii.md): Presidio,
  scrubadub, DataFog, LLM Guard, Philter and Phileas, OpenRedaction,
  redact-pii, pino redaction, NER models and newer projects.
- [`research/closed-source.md`](research/closed-source.md): Google Sensitive
  Data Protection, Azure AI Language PII, AWS Comprehend, Macie and CloudWatch
  Logs, GitHub secret scanning, GitGuardian, Nightfall, Limina (Private AI),
  Skyflow, Tonic Textual, Protecto, Datadog, New Relic, Splunk, Elastic,
  Sentry, Cloudflare, Portkey and Lakera. Section 15 has the feature table.
- [`research/code-architecture-principles.md`](research/code-architecture-principles.md):
  a copy of the principles the issue asks to apply.

Market changes since the issue 1 list: Betterleaks, launched on 2026-03-15 by the
Gitleaks author, has about twice as many rules plus live validation, and
Gitleaks only receives security fixes; Kingfisher (MongoDB) and Titus
are new Rust and Go scanners with checksum validation; Private AI was renamed
Limina; Check Point acquired Lakera (2025-09-16) and NVIDIA reportedly acquired
Gretel (2025-03).

The test cases are in `research/open-source-pii-cases.json` (371),
`research/open-source-secrets-cases.json` (298) and
`research/closed-source-cases.json` (184). Every case records its source URL.
Credential-shaped values are stored split and rebuilt at run time, so the
repository holds no literal token. PII values are the fake samples from the
upstream tests and documentation.

## Solutions considered and chosen

| Gap found in the research    | Options                                                          | Chosen                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Missing provider rules       | Hand-write rules; import secrets-patterns-db; vendor Betterleaks | Vendor the 203 Betterleaks rules not in the frozen Gitleaks set (MIT), with `scripts/sync-betterleaks.py` and a provenance file |
| No offline token validation  | Live verification; CRC32 checksums (Kingfisher)                  | CRC32 base62 checksums for GitHub and npm tokens raise confidence to 0.99; live verification rejected (sends the secret out)    |
| Escape and HTML obfuscation  | Pre-decoding copy of the text; a mapped view                     | Extend the detection view in `src/projection.js`, which keeps original offsets                                                  |
| No allow list or suppression | Path skips; fingerprint files; value lists; inline comments      | Value and whole-match regex allow lists; inline comments off by default; credentials need `allowCredentialDisable`              |
| Mask, encryption, thresholds | Google `characterMaskConfig`, AES-SIV, Presidio thresholds       | `mask` options, HMAC-derived IV AES encryption with `decrypt`, `minConfidenceByType`                                            |
| Custom recognizers           | Code-only detectors; declarative patterns                        | `createPatternDetector` (regex, deny lists, hotwords, validation) and `createIdentifierDetector`                                |
| CI reports                   | SARIF; JUnit; HTML                                               | SARIF 2.1.0 (`toSarif`, `scan --format sarif`) and `.pre-commit-hooks.yaml`                                                     |
| UTF-16 logs                  | Refuse; read with BOM; detect BOM-less                           | Read and write back UTF-16LE/BE with a BOM; NUL-interleaved text in the view                                                    |

Libraries and components reused: Node `crypto` (AES and HMAC), a small CRC32 and
base62 implementation in `src/token-checksum.js`, the vendored Gitleaks and Betterleaks rule sets, the existing
Secretlint preset, the Presidio, Gitleaks and TruffleHog bridges and
`test-anywhere`. No runtime dependency was added.

## Changes

| Commit    | Summary                                                                                     |
| --------- | ------------------------------------------------------------------------------------------- |
| `1b682fc` | National, tax, bank and device identifiers from Presidio, OpenRedaction, DataFog and Google |
| `21f629d` | Courtesy-title names, street suffixes, VINs and UK postcodes                                |
| `63498d2` | Competitor-tested phrases, national IDs and checksummed formats                             |
| `1f465af` | camelCase, named-value, login-call and hashed credentials and escaped tokens                |
| `82e0a68` | Allow lists, per-type thresholds, mask options, encryption, pattern detectors and SARIF     |
| `d6ff0ef` | Inline suppression comments and templated credential placeholders                           |
| `9281de3` | `U+`, `\x{}` and CSS escape runs, UTF-16 NUL bytes and HTML formatting tags                 |
| `2642298` | UTF-16 files with a byte order mark                                                         |
| `dce0a47` | API and coverage documentation                                                              |
| `e495286` | 203 vendored Betterleaks rules                                                              |
| `0e67d11` | Checksum confidence for GitHub and npm tokens; multi-path scan and pre-commit hooks         |
| `44d5eb4` | A finding in an escape run redacts the whole run and keeps the next word                    |
| `59144ef` | `tokenChecksum` and `tokenWithChecksum` exports                                             |
| `3a6f5bf` | IPv4 address followed by a full stop (found by the redact-pii probe)                        |
| `4c9e038` | The exported national rule table is frozen (found by the architecture audit)                |

The comparison pages, this case study and the changeset are in the final
documentation commit.

## Measured results

From [`docs/comparison/measured-results.md`](../../comparison/measured-results.md),
default options:

| Case set            | Before (misses / over-redactions) | After   |
| ------------------- | --------------------------------- | ------- |
| Open-source PII     | 109 / 20                          | 60 / 16 |
| Open-source secrets | 34 / 91                           | 15 / 83 |
| Closed source       | 48 / 15                           | 41 / 15 |

The remaining cases are classified on that page. Most misses are numbers
without a context word, local IP addresses, dates and UUIDs that the default
log profile keeps on purpose, or caller-defined rules that the probe does not
configure. Most over-redactions are code-scanner false-positive fixtures that a
fail-closed redactor removes on purpose.

## Architecture audit

Checked against [code-architecture-principles](research/code-architecture-principles.md).

| Principle                                   | How the new code follows it                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modularity, single responsibility           | One module per feature: `allow-list.js`, `pattern-detector.js`, `identifier-detector.js`, `encrypt.js`, `sarif.js`, `token-checksum.js`, `crypto-addresses.js`, `national-checks.js`                         |
| Ports and adapters, dependency rule         | Detectors share one contract (`detect(text)` returns findings); bridges and report adapters convert outside formats at the edge; the core has no network code                                                |
| Functional core, imperative shell           | Detection, projection, SARIF and checksums are pure functions; file, stream, worker and git I/O stay in `bin/`, `files.js`, `stream.js` and `history*.js`                                                    |
| Validation at boundaries, fail fast         | Every new option is validated and rejected with `ERR_CONFIG` (allow lists, masks, thresholds, keys, pattern specs); oversized input fails closed                                                             |
| Make invalid states impossible              | Credentials cannot be exempted without `allowCredentialDisable`; thresholds never filter credentials; inline comments are off by default                                                                     |
| Immutability, single source of truth        | The built-in rule catalog and the exported `nationalRules` table are frozen (callers extend a copy); vendored rules carry a provenance file and a sync script; rule IDs are listed once in `rule-catalog.js` |
| Open for extension, closed for modification | New rules come through `detectors`, `createPatternDetector` and `createIdentifierDetector` without editing the core; built-in national rules are exported and replaceable                                    |
| Stable contracts, backwards compatibility   | All additions are opt-in options or new exports; defaults are unchanged except for added detections; TypeScript declarations cover the new API                                                               |
| Deterministic core, testability             | Encryption derives its IV from the key and value, so output is repeatable; every feature has unit tests; probes run the competitor cases                                                                     |
| Small units, low nesting                    | ESLint enforces complexity 15, depth 5 and 1500 lines per file; jscpd checks duplication                                                                                                                     |
| Programs work together                      | SARIF, JSON reports, pre-commit hooks, report importers for Gitleaks, TruffleHog, detect-secrets and Presidio                                                                                                |
| Logs as streams                             | `sanitizeStream` and `--stream` process JSONL and text line by line with bounded memory                                                                                                                      |

Known deviations: `src/sanitizer.js` and `src/rule-catalog.js` are over 1000
lines (under the 1500 limit). The rule catalog is a data table; splitting it
would add indirection without reducing complexity.

## Exclusions and remaining gaps

Not implemented, by design:

- Live verification or revocation of credentials (sends the secret to its
  provider).
- Path-based skips (fixtures and docs leak real secrets too).
- Cloud processing and proprietary models.

Not implemented in this pull request (each detailed page lists its own):

- Archives, Office documents, PDF and images.
- Remote sources such as GitHub organisations, S3 and Slack.
- NIST FF1 format-preserving encryption and date shifting.
- JUnit, CSV and HTML reports.
- A fingerprint ignore file bound to file content.
- Double-encoded HTML entities, BOM-less UTF-16 and UTF-32.
- Caller-supplied Gitleaks or Betterleaks TOML at run time and Betterleaks
  Expr filters.

## Experiments

All in [`experiments/issue-128/`](../../../experiments/issue-128/):

| Script                      | Purpose                                                                 |
| --------------------------- | ----------------------------------------------------------------------- |
| `probe-cases.mjs`           | Run one case file with chosen options; print misses and over-redactions |
| `probe-summary.mjs`         | Totals for every case file and option set                               |
| `probe-tools.mjs`           | Misses and over-redactions grouped by competitor                        |
| `feature-parity.mjs`        | Exercise each competitor feature added here                             |
| `betterleaks-samples.mjs`   | Check every vendored Betterleaks rule against its sample                |
| `token-checksum.mjs`        | Build and check CRC32 token checksums                                   |
| `evidence-samples.mjs`      | Personal-data evidence cases                                            |
| `templated-credentials.mjs` | Template and mask values next to credential keys                        |
| `templated-rules.mjs`       | Which built-in rules skip template values                               |
| `fill-template.mjs`         | Rebuild split credential samples                                        |
| `rule-ids.mjs`              | List rule IDs for the catalog                                           |
| `why.mjs`                   | Explain which rule redacted a given input                               |

## Reproduce

```sh
npm ci
node experiments/issue-128/probe-summary.mjs
node experiments/issue-128/probe-tools.mjs
node --test tests/sanitizer-issue-128*.test.js
```
