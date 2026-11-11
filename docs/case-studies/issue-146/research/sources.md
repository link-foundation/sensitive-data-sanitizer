# Primary-source research, 2026-11-10

This supplements the [issue 128 research](../../issue-128/README.md). Counts
refer to a version or snapshot, not an evergreen promise of coverage.

| Source                                                                                                                                    | Finding                                                                                                      | Consequence and possible solution                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Betterleaks v1.10.0 configuration](https://github.com/betterleaks/betterleaks/blob/v1.10.0/docs/config.md)                               | Detection includes expression filters, dependent components and validation definitions                       | Importing just regexes cannot reproduce the engine. Execute the pinned upstream scanner for its full semantics, with validation explicitly off; audit native imports separately.                                                                                         |
| [Betterleaks release](https://github.com/betterleaks/betterleaks/releases/tag/v1.10.0)                                                    | The resolved release config contains 466 rule records in our captured binary                                 | Keep release counts separate from the earlier 474-rule `main` observation. The downloaded Linux archive matches its published checksum.                                                                                                                                  |
| [Kingfisher v2 migration](https://mongodb.github.io/kingfisher/getting-started/v2-migration/)                                             | Candidate detectors derive from Betterleaks and selected Veles detectors                                     | The earlier 503-detector comparison is historical. Shared ancestry does not prove equivalent filters, validation or revocation support. Use pinned catalogs and case-by-case contracts.                                                                                  |
| [Presidio supported entities](https://github.com/data-privacy-stack/presidio/blob/main/docs/supported_entities.md)                        | Recognition spans country-specific rules and configurable language/model recognizers                         | The existing Presidio bridge can reuse installed recognizers. A label catalog or a finite name dictionary cannot establish all-language model equivalence.                                                                                                               |
| [GitHub supported secret patterns](https://docs.github.com/en/code-security/reference/secret-security/supported-secret-scanning-patterns) | GitHub distinguishes generic regex, provider regex and AI-detected patterns                                  | Public labels do not disclose all detector implementations or the AI model. Exact behavioral equivalence needs accessible definitions/models and an adequate evaluation corpus. This conclusion is an inference from the published interface, not a vendor parity claim. |
| [Google infoTypes](https://docs.cloud.google.com/sensitive-data-protection/docs/infotypes-reference)                                      | Google publishes detector categories and descriptions for its managed service                                | Matching names does not reconstruct its contextual detector behavior. A licensed service integration could reuse results with explicit data-transfer policy, but no authenticated project/service access is configured here.                                             |
| [Provider operation references](../../../VERIFICATION.md#built-in-checks)                                                                 | Identity, status, balance, scope and model-list operations can inspect selected tokens without changing them | Use an explicit fixed-endpoint GET catalog; do not run arbitrary third-party verifier definitions against real credentials or automatically equate rejection with a false positive.                                                                                      |

## Existing components considered

- **Secretlint:** retained as the required asynchronous engine. It is already a
  runtime dependency; replacing it would lose existing coverage.
- **Vendored Gitleaks/Betterleaks patterns:** retained for offline native and
  synchronous use. They avoid subprocess deployment but do not cover every
  upstream path/filter/component operation.
- **Actual local Betterleaks engine:** selected for optional additional coverage
  because it implements its own expression language and component matching. It
  adds an installed binary and subprocess overhead only when explicitly chosen.
- **TruffleHog:** the existing detector uses `--no-verification`. Its larger
  verifier catalog includes operations and dependencies that must be reviewed
  individually before enabling network calls here. Copying all verifiers would
  not establish the requested default read-only property.
- **Kingfisher/Veles:** potential additional read-only provider contracts;
  revocation support is deliberately separate from checking. Importing detector
  names alone would not implement either contract.
- **Presidio and optional NLP recognizers:** existing extension routes for
  languages and statistical recognition. They require installed models and
  representative evaluation; the Node dependency is not a replacement for all
  proprietary PII models.
- **Generic HTTP verifier templates:** rejected for this API because an input
  candidate must not select a destination, redirect credentials or invoke a
  destructive endpoint. Adding one provider requires an explicit reviewed
  operation and response contract.

## Evidence limits

No live credential was requested, loaded or sent in development. Mocked provider
responses test request construction and failure handling. They do not certify
live availability, every token scope, every authentication scheme or every
popular service. There is no configured licensed account for proprietary DLP
comparisons. These missing inputs cannot be replaced with a passing local test
or a manufactured equivalence claim.
