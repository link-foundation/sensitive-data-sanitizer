# Suppression and allow lists

[← Comparison overview](../COMPARISON.md). Sources: Gitleaks, Betterleaks,
TruffleHog, Kingfisher, detect-secrets, ripsecrets, Talisman and Trivy in the
[open-source secrets research](../case-studies/issue-128/research/open-source-secrets.md)
(section 2); Presidio and DataFog in the
[open-source PII research](../case-studies/issue-128/research/open-source-pii.md);
Google, Azure, Nightfall, Datadog and Sentry in the
[closed-source research](../case-studies/issue-128/research/closed-source.md)
(section 15). Legend: **Y** supported, **P** partial, **–** absent, **?**
unverified.

## Feature matrix

| Feature                               | This project                            | Gitleaks              | Betterleaks              | TruffleHog              | Kingfisher              | detect-secrets          | ripsecrets           | Talisman                    | Trivy               | Presidio | Google SDP       | Azure PII | Nightfall | Sentry          |
| ------------------------------------- | --------------------------------------- | --------------------- | ------------------------ | ----------------------- | ----------------------- | ----------------------- | -------------------- | --------------------------- | ------------------- | -------- | ---------------- | --------- | --------- | --------------- |
| Allow list of exact values            | Y (`allowList` strings)                 | Y (stopwords)         | Y                        | P (word lists)          | Y (`--skip-word`)       | –                       | –                    | P                           | Y                   | Y        | Y (dictionary)   | Y         | Y         | –               |
| Allow list of whole-value regexes     | Y (`allowList` RegExp, anchored)        | Y                     | Y                        | –                       | Y (`--skip-regex`)      | –                       | –                    | Y                           | Y                   | Y        | Y (full match)   | Y         | Y         | –               |
| Inline suppression comment            | Y (`inlineAllow`, off by default)       | Y (`gitleaks:allow`)  | Y (`betterleaks:allow`)  | Y (`trufflehog:ignore`) | Y (`kingfisher:ignore`) | Y (`pragma`)            | Y (`pragma`)         | –                           | –                   | n/a      | n/a              | n/a       | n/a       | n/a             |
| Other tools' directives               | Y (all of the above, `NOSONAR`)         | –                     | –                        | –                       | Y (`--ignore-comment`)  | –                       | Y (`pragma`)         | –                           | –                   | n/a      | n/a              | n/a       | n/a       | n/a             |
| Next-line directive                   | Y (`pragma: allowlist nextline secret`) | –                     | –                        | –                       | Y (preceding line)      | Y                       | –                    | –                           | –                   | n/a      | n/a              | n/a       | n/a       | n/a             |
| Template / placeholder values skipped | Y (credentials only, built-in rules)    | Y                     | Y                        | Y                       | Y                       | Y                       | Y                    | –                           | –                   | –        | –                | –         | –         | –               |
| Per-type confidence thresholds        | Y (`minConfidenceByType`)               | –                     | P (`setConfidence`)      | –                       | P (rule confidence)     | –                       | –                    | P (severity)                | –                   | Y        | Y (likelihood)   | Y         | Y         | –               |
| Disable rules or types                | Y (`rules`, `types`)                    | Y                     | Y                        | Y                       | Y                       | Y                       | –                    | Y (`ignore_detectors`)      | Y (`disable-rules`) | Y        | Y                | Y         | Y         | Y               |
| Field / key exemptions                | Y (`fields`, structured mode)           | –                     | –                        | –                       | –                       | P (ID keys)             | –                    | –                           | –                   | –        | Y (table fields) | –         | –         | Y (safe fields) |
| Public entities kept on evidence      | Y (`publicEntities`, public verifier)   | –                     | –                        | –                       | –                       | –                       | –                    | –                           | –                   | –        | –                | –         | –         | –               |
| Fingerprint ignore file / baseline    | P (detect-secrets baseline import)      | Y (`.gitleaksignore`) | Y (`.betterleaksignore`) | –                       | Y (YAML baseline)       | Y (`.secrets.baseline`) | Y (`.secretsignore`) | Y (`.talismanrc` + SHA-256) | Y                   | –        | –                | –         | –         | –               |
| Path-based skips                      | – (by design)                           | Y                     | Y                        | Y                       | Y                       | Y                       | Y                    | Y                           | Y (tests, docs)     | n/a      | n/a              | n/a       | n/a       | n/a             |
| Suppression cannot hide credentials   | Y (`allowCredentialDisable` required)   | –                     | –                        | –                       | –                       | –                       | –                    | –                           | –                   | n/a      | n/a              | n/a       | n/a       | n/a             |

## Safety rules here

The project is a redactor for logs and documents that other people may write
into, so every suppression is opt-in and bounded:

- `inlineAllow` is off by default: a log line containing `gitleaks:allow`
  could otherwise disable redaction for an attacker's value.
- Allow lists and inline comments never exempt `knownSecrets`,
  `knownPersonal`, confirmed personal values or structured `JSON_VALUE` denials.
- Credentials are exempted only with `allowCredentialDisable: true`.
- Template-value skipping applies to built-in credential rules only; a value
  that mixes a template with real text (`alice:${DB_PASSWORD}`) is still
  redacted, and custom detectors are never filtered.
- Thresholds never filter credentials.

See [Allow lists, suppression comments and template values](../API.md#allow-lists-suppression-comments-and-template-values),
[Per-type thresholds](../API.md#per-type-thresholds) and
[Rule, type and field policy](../API.md#rule-type-and-field-policy).

## Added for issue 128

- `allowList` (Presidio `allow_list`, Google exclusion rules with full match,
  DataFog `allowlist_patterns`).
- `inlineAllow` with the directives of Gitleaks, Betterleaks, TruffleHog,
  Kingfisher, detect-secrets, ripsecrets, SonarQube and `sanitizer:allow`.
- Template and mask values (`${PASSWORD}`, `<password>`, `****`, `$1`) skipped
  by built-in credential rules, from Gitleaks, Betterleaks, detect-secrets and
  whispers false-positive fixtures.
- `minConfidenceByType` (Presidio score thresholds, Azure per-category
  confidence, Google per-infoType likelihood).

## Remaining gaps

- A fingerprint ignore file such as `.gitleaksignore`. A fingerprint bound to
  the file content (Talisman's SHA-256) would be the safe design; it is not
  implemented.
- Path-based skips are not offered on purpose: test fixtures and docs leak
  real secrets too.
- Partial-match exclusion rules (Google `MATCHING_TYPE_PARTIAL_MATCH`) are
  not supported; an allow list entry must match the whole detected value.
