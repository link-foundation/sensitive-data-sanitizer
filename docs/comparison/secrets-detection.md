# Secrets detection

[← Comparison overview](../COMPARISON.md). Sources:
[open-source secrets research](../case-studies/issue-128/research/open-source-secrets.md)
and [closed-source research](../case-studies/issue-128/research/closed-source.md)
(sections 5 and 6). Legend: **Y** supported, **P** partial, **–** absent, **?**
unverified.

## Tools and rule sets

| Tool                   | Licence          | Version reviewed   | Rules / detectors                                                                                | Status                                 |
| ---------------------- | ---------------- | ------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------- |
| This project           | Unlicense        | 0.20.0             | 51 native + 221 Gitleaks + 203 Betterleaks text rules, Secretlint 13.1.0 recommended preset (27) | Active                                 |
| Gitleaks               | MIT              | 8.30.1             | 222                                                                                              | Frozen, security fixes only            |
| Betterleaks            | MIT              | 1.10.0             | 474 on `main`                                                                                    | Active (Gitleaks author)               |
| TruffleHog             | AGPL-3.0         | 3.99.8             | 800+ detectors, 700+ verifiable                                                                  | Active                                 |
| Kingfisher             | Apache-2.0       | 2.18.1             | 503                                                                                              | Active (MongoDB)                       |
| Titus                  | Apache-2.0       | 1.3.0              | 487                                                                                              | Active; replaces archived Nosey Parker |
| detect-secrets         | Apache-2.0       | 1.5.0 (+ IBM fork) | 26 plugins + filters                                                                             | Maintenance                            |
| Secretlint             | MIT              | 13.1.0             | 27 in the recommended preset                                                                     | Active; a required engine here         |
| ripsecrets             | MIT              | 0.1.11             | about 30 patterns + randomness test                                                              | Low activity                           |
| Trivy                  | Apache-2.0       | 0.76.2             | 106                                                                                              | Active                                 |
| Talisman               | MIT              | 1.37.0             | detector categories                                                                              | Low activity                           |
| whispers               | Apache-2.0       | 1.5.3              | rule YAML + structured parsers                                                                   | Archived                               |
| GitHub secret scanning | closed           | —                  | about 500 provider + 10 generic + AI                                                             | Active                                 |
| GitGuardian / ggshield | closed / MIT CLI | ggshield 1.56.1    | 500+ (?)                                                                                         | Active; needs an API key               |

The Betterleaks rules vendored here are the 203 whose ids are not in the
Gitleaks set. They keep their original RE2 patterns, keywords, entropy
thresholds and secret-only filters; their `tokenRatio` filters, components and
validation are not ported ([provenance](../../src/vendor/betterleaks/provenance.json)).

## Feature matrix

| Feature                                         | This project                           | Gitleaks       | Betterleaks      | TruffleHog | Kingfisher            | Titus | detect-secrets | Secretlint | ripsecrets | Trivy | Talisman | whispers |
| ----------------------------------------------- | -------------------------------------- | -------------- | ---------------- | ---------- | --------------------- | ----- | -------------- | ---------- | ---------- | ----- | -------- | -------- |
| Provider-specific rules                         | Y                                      | Y              | Y                | Y          | Y                     | Y     | P              | Y          | P          | Y     | –        | P        |
| Generic keyword/assignment rules                | Y (labels in 17 languages)             | Y              | Y                | P          | P                     | P     | Y              | P          | Y          | –     | –        | Y        |
| camelCase, named-value and login-call secrets   | Y                                      | P              | P                | –          | –                     | –     | Y              | –          | P          | –     | –        | Y        |
| Hashed credentials (htpasswd, bcrypt in config) | P (hashes are redacted as credentials) | –              | P (filtered)     | –          | –                     | –     | –              | –          | –          | –     | –        | Y        |
| Entropy / randomness test                       | Y (`--paranoid`)                       | Y              | Y                | P          | Y                     | ?     | Y              | –          | Y          | –     | Y        | –        |
| BPE token-efficiency filter                     | –                                      | –              | Y                | –          | –                     | –     | –              | –          | –          | –     | –        | –        |
| Confidence on every finding                     | Y (0–1 plus likelihood)                | –              | Y                | P          | Y                     | Y     | –              | –          | –          | P     | P        | Y        |
| Offline CRC32 checksum (GitHub, npm)            | Y (confidence 0.99)                    | –              | –                | –          | Y                     | –     | –              | –          | –          | –     | –        | –        |
| Luhn / IBAN / national checksums                | Y                                      | –              | –                | –          | Y                     | –     | –              | –          | –          | –     | P        | –        |
| Composite rules (key + secret pairs)            | P (credential context)                 | Y (`required`) | Y (`components`) | Y          | Y (`depends_on_rule`) | ?     | –              | –          | –          | –     | –        | –        |
| Template / placeholder negatives                | Y                                      | Y              | Y                | Y          | Y                     | ?     | Y              | –          | Y          | –     | –        | Y        |
| Ciphertext / hash negatives                     | – (redacted on purpose)                | –              | Y                | –          | –                     | –     | –              | –          | –          | –     | –        | –        |
| Canary-token labelling                          | –                                      | –              | –                | –          | Y                     | –     | –              | –          | –          | –     | –        | –        |
| Live verification / revocation                  | – (by design)                          | –              | Y                | Y          | Y                     | Y     | P              | –          | –          | –     | –        | –        |
| Caller-known secrets (env, gh config)           | Y                                      | –              | –                | –          | –                     | –     | –              | –          | –          | –     | –        | –        |
| Credentials in personal-data context            | Y (one pass)                           | –              | –                | –          | P                     | –     | –              | –          | –          | –     | P        | –        |

## How to use the features here

- Credential rules run by default; `credentialsOnly: true` (CLI
  `--credentials-only`) keeps personal data.
- `knownSecrets`, `knownSecretsFromEnv()`, `knownSecretsFromGitHubAuth()` and
  `knownSecretsFromGitHubConfig()` add exact values the caller already knows.
- `--paranoid` adds entropy heuristics.
- `tokenChecksum(value)` and the 0.99 confidence for checksum-valid GitHub and
  npm tokens are described in [the API](../API.md#offline-token-checksums).
- `createGitleaksDetector()`, `createTrufflehogDetector()` and the
  detect-secrets baseline adapter run or import the real scanners
  ([extensibility](extensibility.md)).

## Tests taken from competitors

- Gitleaks and Betterleaks positive and false-positive fixtures, TruffleHog
  decoder tests, detect-secrets filter tests, ripsecrets and whispers fixtures,
  Kingfisher directives: [open-source-secrets-cases.json](../case-studies/issue-128/research/open-source-secrets-cases.json).
- Regression tests: `tests/sanitizer-issue-128.test.js`,
  `tests/sanitizer-issue-128-features.test.js`,
  `tests/sanitizer-issue-128-checksum.test.js`,
  `tests/sanitizer-rules.test.js` (every vendored rule id and sample).

## Remaining gaps

- Betterleaks `tokenRatio`, nearby-line components and expression filters
  (`generic-*` Expr filters) are not ported. Without them the vendored generic
  rules keep only entropy and keyword filters.
- Ciphertext, hash and algorithm-name negatives from Betterleaks are
  intentionally redacted; they account for most remaining over-redactions in
  [measured results](measured-results.md#secrets).
- No canary-token labels and no live verification.
