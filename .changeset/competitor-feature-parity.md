---
'@link-foundation/sensitive-data-sanitizer': minor
---

Match the strongest features of competing secret and PII tools. Add national, tax, bank and device identifiers from Presidio, OpenRedaction, DataFog and Google; 203 vendored Betterleaks rules; offline CRC32 checks for GitHub and npm tokens (`tokenChecksum`, `tokenWithChecksum`); escape-run, HTML-tag and UTF-16 decoding; `allowList`, `inlineAllow` and `minConfidenceByType`; mask tuning and deterministic `encrypt` with `decrypt`; `createPatternDetector`, `createIdentifierDetector`, `identifierChecks` and the read-only `nationalRules` table; SARIF output (`toSarif`, `scan --format sarif`), multi-path `scan` and pre-commit hooks. Detect an IPv4 address followed by a full stop. Add a competitor comparison with measured results on 853 competitor test cases.
