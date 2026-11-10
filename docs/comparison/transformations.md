# Transformations

[← Comparison overview](../COMPARISON.md). Sources: Presidio, Phileas,
OpenRedaction, LLM Guard, Rehydra, flare-redact and cloakrs in the
[open-source PII research](../case-studies/issue-128/research/open-source-pii.md)
(sections 2–13), and Google, Azure, AWS, Nightfall, Limina, Skyflow, Tonic,
Datadog and Sentry in the
[closed-source research](../case-studies/issue-128/research/closed-source.md)
(section 15). Legend: **Y** supported, **P** partial, **–** absent or not
documented, **?** unverified.

## Open source

| Transformation                   | This project                                     | Presidio        | scrubadub | DataFog | LLM Guard | Phileas      | OpenRedaction | Rehydra | flare-redact | cloakrs |
| -------------------------------- | ------------------------------------------------ | --------------- | --------- | ------- | --------- | ------------ | ------------- | ------- | ------------ | ------- |
| Fixed replacement (`[REDACTED]`) | Y (`redact`)                                     | Y               | Y         | Y       | Y         | Y            | Y             | Y       | Y            | Y       |
| Numbered type tokens             | Y (`placeholder`, template `[{TYPE}_{n}]`)       | P (custom op)   | Y         | Y       | Y         | Y            | Y             | Y       | Y            | Y       |
| Restore from a map               | Y (`restore`, digest-bound)                      | Y (deanonymize) | –         | –       | Y (Vault) | –            | Y             | Y       | P            | Y       |
| Partial mask                     | Y (`mask`: keep, char, ignore, count, fromEnd)   | Y               | –         | –       | P         | Y            | Y             | –       | Y            | Y       |
| Keyed hash / pseudonym           | Y (HMAC-SHA256)                                  | Y (salted)      | Y         | Y       | Y         | Y            | ?             | –       | Y (HMAC)     | ?       |
| Reversible encryption            | Y (AES-256-GCM, deterministic)                   | Y (AES)         | –         | –       | –         | Y (AES, FPE) | –             | Y (map) | –            | –       |
| Realistic fake values            | Y (checksum-valid, locale-aware, declined names) | P (custom op)   | –         | –       | Y (Faker) | Y            | Y             | –       | Y            | ?       |
| Shape-preserving pseudonym       | Y (`format-preserving`)                          | –               | –         | –       | –         | Y (FPE)      | Y             | –       | Y            | ?       |
| Date shift                       | Y (`date-shift`)                                 | –               | –         | –       | –         | Y            | –             | –       | –            | –       |
| Numeric bucketing                | Y (`bucket`)                                     | –               | –         | –       | –         | P            | –             | –       | –            | –       |
| Per-type callback                | Y                                                | Y (custom op)   | P         | –       | –         | –            | –             | –       | –            | –       |
| Remove key from structured data  | Y (`sensitiveFields`)                            | P               | –         | –       | –         | –            | –             | –       | Y            | Y       |

## Closed source

| Transformation              | This project                     | Google           | Azure | AWS | Nightfall | Limina | Skyflow | Tonic     | Datadog  | Sentry |
| --------------------------- | -------------------------------- | ---------------- | ----- | --- | --------- | ------ | ------- | --------- | -------- | ------ |
| Full redaction / fixed text | Y                                | Y                | –     | –   | Y         | –      | –       | –         | Y        | Y      |
| Replace with type name      | Y (placeholder format, callback) | Y                | Y     | Y   | Y         | Y      | Y       | –         | –        | Y      |
| Numbered type markers       | Y                                | –                | Y     | –   | –         | Y      | Y       | –         | –        | –      |
| Hash-suffixed markers       | –                                | –                | –     | –   | –         | Y      | –       | Y         | –        | –      |
| Character mask, full length | Y                                | Y                | Y     | Y   | Y         | Y      | –       | –         | –        | Y      |
| Mask count and direction    | Y (`count`, `fromEnd`)           | Y                | –     | –   | Y         | –      | –       | –         | Y        | –      |
| Mask: characters to ignore  | Y (`ignore`, `ignoreClasses`)    | Y                | –     | –   | Y         | –      | –       | –         | –        | –      |
| Dictionary replacement      | Y (`pools` for fake values)      | Y                | –     | –   | –         | –      | –       | –         | –        | –      |
| Synthetic values            | Y                                | –                | Y     | –   | –         | Y      | –       | Y         | –        | –      |
| Keyed hash                  | Y                                | Y                | –     | –   | –         | Y      | –       | –         | FarmHash | Y      |
| Reversible encryption       | Y (AES-256-GCM)                  | Y (FPE, AES-SIV) | –     | –   | RSA       | –      | Vault   | Retention | Unmask   | –      |
| Date shift                  | Y                                | Y                | –     | –   | –         | –      | Y       | –         | –        | –      |
| Bucketing                   | Y                                | Y                | –     | –   | –         | –      | –       | –         | –        | –      |

## Policy

Credentials are always fully redacted: masks, hashes, encryption and fake
values apply to personal data only, except `hive-mask` or `fake` with
`credentials: true`. Residual verification checks the fully redacted
representation, so opted-in disclosures cannot hide an unrelated leak. See
[Transformations and confidence](../API.md#transformations-and-confidence),
[Character masks](../API.md#character-masks) and
[Deterministic encryption](../API.md#deterministic-encryption).

## Added for issue 128

- `mask` options `char`, `ignore`, `ignoreClasses`, `count` and `fromEnd`
  (Google `characterMaskConfig`, Nightfall `maskConfig`, Presidio `mask`).
- `{mode: 'encrypt', key}` and `decrypt(text, key)` (Google
  `CryptoDeterministicConfig`, Presidio `encrypt`/`decrypt`).

## Remaining gaps

- NIST FF1 format-preserving encryption (Google FPE, Phileas FPE): the
  `format-preserving` mode is a keyed shape pseudonym and is not reversible.
- Hash-suffixed markers (`NAME_GIVEN_a1b2`, Limina and Tonic).
- Output offsets in the transformed text are recorded only in the placeholder
  restore map, not in every result.
- Conditional transformations (Phileas policy conditions).
