# Documented outstanding capabilities

Captured from current comparison pages on 2026-11-10. These entries remain
unfinished under issue 146; an existing documented omission is not completion.
The optional verification feature supersedes the old exclusion of live checks.

## decoding-and-encodings

Source: [comparison page](../../../comparison/decoding-and-encodings.md)

- Double-encoded HTML entities (`&amp;#112;`), which TruffleHog decodes.
- BOM-less UTF-16 and UTF-32 detection.
- Separate scans of HTML attribute values.
- Archives, Office documents, PDF and images.
- Compressed or encrypted payloads (out of scope for a text redactor).

## deployment

Source: [comparison page](../../../comparison/deployment.md)

- Archives, Office documents, PDF and images.
- Remote sources such as GitHub organisations, S3 buckets or Slack.
- Live checks are [explicitly opt-in](../../../VERIFICATION.md) for twelve providers;
  paired credentials and other token types remain unsupported.

## extensibility

Source: [comparison page](../../../comparison/extensibility.md)

- Loading Gitleaks or Betterleaks TOML rule files supplied by the caller at
  run time (the vendored rules are compiled at build time; custom rules use
  `createPatternDetector`).
- Betterleaks Expr filters (`tokenRatio`, `components`) are not interpreted.
- Rule packs from secrets-patterns-db are not imported (CC-BY-SA-4.0
  share-alike licence).

## pii-detection

Source: [comparison page](../../../comparison/pii-detection.md)

- Names without any cue (title, label, greeting, gazetteer entry) need an NER
  model; the optional detectors are the supported route.
- Generic dates, IP addresses and UUIDs are not personal data by default.
  Competitors disagree (Presidio reports UUIDs, DataFog treats them as
  negatives). Callers can enable them with a pattern detector.
- Adjacent values with no separator (`john@acme.com123-45-6789`, a DataFog
  edge case) are not split.
- Conditional policies such as Phileas "ZIP only if population < N" are not
  supported.

## reporting-and-ci

Source: [comparison page](../../../comparison/reporting-and-ci.md)

- JUnit, CSV and HTML report formats.
- GitHub Actions workflow-command annotations without SARIF upload.

## secrets-detection

Source: [comparison page](../../../comparison/secrets-detection.md)

- Betterleaks `tokenRatio`, nearby-line components and expression filters
  (`generic-*` Expr filters) are not ported. Without them the vendored generic
  rules keep only entropy and keyword filters.
- Ciphertext, hash and algorithm-name negatives from Betterleaks are
  intentionally redacted; they account for most remaining over-redactions in
  [measured results](../../../comparison/measured-results.md#secrets).
- No canary-token labels. [Optional verification](../../../VERIFICATION.md) covers
  twelve providers, not all token types or popular services.

## suppression-and-allow-lists

Source: [comparison page](../../../comparison/suppression-and-allow-lists.md)

- A fingerprint ignore file such as `.gitleaksignore`. A fingerprint bound to
  the file content (Talisman's SHA-256) would be the safe design; it is not
  implemented.
- Path-based skips are not offered on purpose: test fixtures and docs leak
  real secrets too.
- Partial-match exclusion rules (Google `MATCHING_TYPE_PARTIAL_MATCH`) are
  not supported; an allow list entry must match the whole detected value.

## transformations

Source: [comparison page](../../../comparison/transformations.md)

- NIST FF1 format-preserving encryption (Google FPE, Phileas FPE): the
  `format-preserving` mode is a keyed shape pseudonym and is not reversible.
- Hash-suffixed markers (`NAME_GIVEN_a1b2`, Limina and Tonic).
- Output offsets in the transformed text are recorded only in the placeholder
  restore map, not in every result.
- Conditional transformations (Phileas policy conditions).
