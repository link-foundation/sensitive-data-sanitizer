# Closed-source and commercial competitors (issue #128 research)

Research date: 2026-11-10. Scope: hosted, commercial, or source-available services that
detect and transform personal data or secrets. Every claim links to the page it came from.
Items marked **(unverified)** came from marketing pages, secondary reporting or search
snippets that could not be confirmed on a primary documentation page.

Companion data: [closed-source-cases.json](closed-source-cases.json) holds the example
inputs from vendor documentation in the shared `{tool, source, input, sensitive, types,
expectedOutput?, negative, notes}` format. Only sample values printed in the vendor docs
are used. Provider-prefixed credentials are never written out literally. Where a doc uses
one, the case gives `{{TOKEN}}` and describes the format.

The previous proprietary comparison
([issue-1 COMPETITORS.md](../../issue-1/COMPETITORS.md)) covered only Google, Azure, AWS
and GitGuardian. This document extends it.

## 1. Summary table

| Service                          | Licence / delivery                                         | Built-in types (approx.)                       | Transformations                                                                                         | Reversible                         | Offline / self-host                             |
| -------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------- |
| Google Sensitive Data Protection | Closed SaaS API, pay per GB                                | ~214 infoTypes                                 | 12 primitives (redact, replace, dictionary, mask, hash, FPE, AES-SIV, bucketing, date shift, time part) | FPE and AES-SIV                    | No                                              |
| Azure AI Language PII            | Closed SaaS API, plus Docker containers                    | ~182 entity types                              | characterMask, entityMask, syntheticReplacement, noMask                                                 | No                                 | Containers (disconnected needs commitment plan) |
| AWS Comprehend PII               | Closed SaaS API                                            | 36 entity types                                | MASK or REPLACE_WITH_PII_ENTITY_TYPE (async jobs only)                                                  | No                                 | No                                              |
| AWS Macie                        | Closed SaaS (S3 only)                                      | managed identifiers incl. credentials          | Detection only                                                                                          | n/a                                | No                                              |
| AWS CloudWatch Logs protection   | Closed SaaS                                                | managed + 10 custom per policy                 | Mask at ingestion, unmask by IAM permission                                                             | Yes (permission-gated view)        | No                                              |
| Azure Purview                    | Closed SaaS                                                | sensitive information types (count unverified) | Classification / DLP policy                                                                             | n/a                                | No                                              |
| GitGuardian                      | Closed SaaS; ggshield CLI open source (licence unverified) | 385-550+ detectors (unverified)                | Detection, incident workflow                                                                            | n/a                                | Self-hosted edition (unverified)                |
| GitHub secret scanning           | Closed, part of GitHub                                     | ~500 provider patterns + 10 non-provider + AI  | Alert, push protection block                                                                            | n/a                                | GitHub Enterprise Server (unverified)           |
| Nightfall                        | Closed SaaS API                                            | ~150 detectors                                 | mask, infoType substitution, phrase substitution, RSA encryption                                        | RSA encryption (customer key)      | No                                              |
| Limina (formerly Private AI)     | Closed, container licence                                  | 50+ entities, 49+ languages                    | MASK, MARKER (numbered/hashed), SYNTHETIC                                                               | Via returned entity map            | Yes (container)                                 |
| Skyflow Detect                   | Closed SaaS + vault                                        | 60 entities, 40+ languages                     | vault token, counter token, entity-only token, date shift                                               | Yes (vault re-identification)      | No                                              |
| Tonic Textual                    | Closed SaaS / self-host licence                            | 44 types                                       | Redact (hashed placeholders), Synthesis, Off                                                            | Re-identification within retention | Self-hosted option (unverified)                 |
| Protecto                         | Closed SaaS                                                | not published                                  | Deterministic tokens (Text, Numeric, Special), format tokens                                            | Yes (unmask API)                   | Unverified                                      |
| Datadog Sensitive Data Scanner   | Closed SaaS / Observability Pipelines                      | 90+ library rules (unverified)                 | redact, partial redact, hash (FarmHash), mask (unmaskable)                                              | Mask only, by permission           | Pipelines worker                                |
| New Relic obfuscation            | Closed SaaS                                                | built-in card + SSN                            | MASK (X), HASH_SHA256                                                                                   | No                                 | No                                              |
| Splunk / Elastic                 | Closed / Elastic licence                                   | user-written                                   | sed replacement / grok redact                                                                           | No                                 | Yes                                             |
| Sentry data scrubbing            | SaaS; Relay is FSL-1.1-Apache-2.0                          | 19 rule types, ~15 @-rules                     | remove, mask, hash, replace                                                                             | No                                 | Relay self-host                                 |
| Cloudflare DLP / AI Gateway DLP  | Closed SaaS                                                | predefined profiles                            | Flag / block (no redaction in AI Gateway)                                                               | n/a                                | No                                              |
| Portkey (Prisma AIRS AI Gateway) | Closed SaaS; gateway core open source (unverified)         | 7 categories                                   | numbered placeholders, custom regex replacement                                                         | No                                 | Gateway self-host (unverified)                  |
| Lakera (Check Point)             | Closed SaaS                                                | 8 PII detectors + custom regex                 | block or mask (offsets returned)                                                                        | No                                 | Self-hosted enterprise (unverified)             |
| Strac                            | Closed SaaS                                                | 100-250+ (unverified)                          | redact API (unverified)                                                                                 | Unverified                         | No                                              |
| Gretel                           | Acquired by NVIDIA (2025)                                  | n/a                                            | Synthetic data / transform                                                                              | n/a                                | n/a                                             |

Sources for each row are given in the per-service sections below.

## 2. Google Sensitive Data Protection (Cloud DLP)

- URL: <https://docs.cloud.google.com/sensitive-data-protection/docs>. The old
  `cloud.google.com/dlp` and `cloud.google.com/sensitive-data-protection` paths now
  redirect (HTTP 301) to `docs.cloud.google.com`.
- Pricing: usage-based per GB inspected or transformed, with discovery profiles priced
  separately. See <https://cloud.google.com/sensitive-data-protection/pricing>.
- Closed source. Client libraries are open source, the service is not.

### Entities

- The infoType reference lists about 214 built-in infoTypes, and it changes monthly:
  <https://docs.cloud.google.com/sensitive-data-protection/docs/infotypes-reference>.
  A first manual count of table rows gave about 265, which was too high. A
  recount of the `UPPER_SNAKE` identifiers on the page gave 214, matching the
  branch's `entityCatalogs` (213 names on `main`).
- There are 21 credential/secret infoTypes, from the same page:
  - ANTHROPIC_API_KEY, AUTH_TOKEN, AWS_CREDENTIALS, AZURE_AUTH_TOKEN, BASIC_AUTH_HEADER
  - ENCRYPTION_KEY, GCP_API_KEY, GCP_CREDENTIALS, GEMINI_API_KEY, HTTP_COOKIE
  - JSON_WEB_TOKEN, OAUTH_CLIENT_SECRET, OPENAI_API_KEY, PASSWORD, SECURITY_DATA
  - SSL_CERTIFICATE, STORAGE_SIGNED_POLICY_DOCUMENT, STORAGE_SIGNED_URL, TINK_KEYSET
  - WEAK_PASSWORD_HASH, XSRF_TOKEN
- Each infoType carries a sensitivity score (HIGH, MODERATE or LOW):
  <https://docs.cloud.google.com/sensitive-data-protection/docs/sensitivity>.
- Changes in 2025-2026, from
  <https://docs.cloud.google.com/sensitive-data-protection/docs/release-notes>:
  - 2025:
    - New infoTypes: CVV_NUMBER, CREDIT_CARD_EXPIRATION_DATE, MAC_ADDRESS_UNIVERSAL,
      BRAZIL_RG_NUMBER, KOREA_NHI_NUMBER.
    - SOURCE_CODE document types.
    - FACE detection (preview).
  - 2026-02-23: adjustment rules reach GA.
  - 2026-03-13: USER_NAME.
  - 2026-06-03: conversational content inspection.
  - 2026-06-12: batched content items.
  - 2026-08-13: AI API key infoTypes become available in all regions.
  - 2026-08-31: content policies reach GA.
  - 2026-10-03: a PERSON_NAME dictionary option.
  - 2026-11-02: TIFF images.

### Detection, likelihood and hotwords

- Every finding has a likelihood from VERY_UNLIKELY to VERY_LIKELY, plus a quote and a
  location.
  - Example: inspecting `My phone number is (415) 555-0890` returns PHONE_NUMBER at
    VERY_LIKELY, with `byteRange` and `codepointRange` both 19-33.
  - Source: <https://docs.cloud.google.com/sensitive-data-protection/docs/inspecting-text>.
- Hotword rules change likelihood by proximity. Source:
  <https://docs.cloud.google.com/sensitive-data-protection/docs/creating-custom-infotypes-likelihood>.
  - Settings: `windowBefore`/`windowAfter` in characters, and either `fixedLikelihood`
    or `relativeLikelihood`. Relative changes are clamped at the ends of the scale.
  - Example: the custom regex `C_MRN` is `[0-9]{3}-[0-9]{1}-[0-9]{5}` at POSSIBLE. The
    hotword `(?i)(mrn|medical)(?-i)` with `windowBefore` 10 raises a match to VERY_LIKELY.
    In `Patient's MRN 444-5-22222 and just a number 333-2-33333`, the first match is
    VERY_LIKELY and the second stays POSSIBLE.
  - In tables, a hotword can target column headers. A header `Fake Social Security
Number` lowers `111-11-1111` to VERY_UNLIKELY.
- Exclusion rules and their matching types are documented at
  <https://docs.cloud.google.com/sensitive-data-protection/docs/creating-custom-infotypes-rules>:
  - Rule kinds: `dictionary`, `regex`, `excludeInfoTypes`, `excludeByHotword`.
  - Matching types: `MATCHING_TYPE_FULL_MATCH`, `PARTIAL_MATCH`, `INVERSE_MATCH`.
  - Example: a dictionary `example@example.com` with FULL_MATCH, on `Some email
addresses: gary@example.com, example@example.com`, keeps only gary@.
  - Example: regex `.+@example.com` excludes gary@example.com and keeps
    bob@example.org.
  - Example: PARTIAL_MATCH on `TEST` excludes `TEST@example.com`.
- Custom infoTypes come in four kinds: regex (RE2), dictionary (word list), stored
  dictionary (large lists), and surrogate. Source:
  <https://docs.cloud.google.com/sensitive-data-protection/docs/creating-custom-infotypes>.

### Transformations

Source: <https://docs.cloud.google.com/sensitive-data-protection/docs/transformations-reference>.

| Primitive                   | Behaviour                                                                                                                                                                                      | Reversible |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `redactConfig`              | Remove the value                                                                                                                                                                               | No         |
| `replaceConfig`             | Fixed replacement value                                                                                                                                                                        | No         |
| `replaceDictionaryConfig`   | Random word from a supplied list                                                                                                                                                               | No         |
| `replaceWithInfoTypeConfig` | Replace with infoType name                                                                                                                                                                     | No         |
| `characterMaskConfig`       | `maskingCharacter`, `numberToMask`, `reverseOrder`, `charactersToIgnore` (common sets or explicit chars)                                                                                       | No         |
| `cryptoHashConfig`          | HMAC-SHA-256 with a key, base64 output                                                                                                                                                         | No         |
| `cryptoReplaceFfxFpeConfig` | FPE-FFX; `commonAlphabet` NUMERIC / HEXADECIMAL / UPPER_CASE_ALPHA_NUMERIC / ALPHA_NUMERIC, or a custom alphabet (2-95 ASCII chars) or radix; optional `context` tweak and `surrogateInfoType` | Yes        |
| `cryptoDeterministicConfig` | AES-SIV; output is not format-preserving; optional surrogate and context                                                                                                                       | Yes        |
| `fixedSizeBucketingConfig`  | Numeric buckets of fixed width between lower and upper bounds                                                                                                                                  | No         |
| `bucketingConfig`           | Custom ranges with replacement labels                                                                                                                                                          | No         |
| `dateShiftConfig`           | Random shift in `[lowerBoundDays, upperBoundDays]` (±100 max), consistent per `context` field                                                                                                  | No         |
| `timePartConfig`            | Keep only year / month / day of week / hour and similar                                                                                                                                        | No         |

Examples from <https://docs.cloud.google.com/sensitive-data-protection/docs/deidentify-sensitive-data>.
The input in every row is `My name is Alicia Abernathy, and my email address is aabernathy@example.com.`

| Transformation                        | Output                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------- |
| redact (EMAIL_ADDRESS)                | `My name is Alicia Abernathy, and my email address is .`                    |
| replace `[email-address]`             | `... my email address is [email-address].`                                  |
| dictionary (`izumi@example.com`, ...) | `... my email address is izumi@example.com.`                                |
| replace with infoType (+ LAST_NAME)   | `My name is Alicia LAST_NAME, and my email address is EMAIL_ADDRESS.`       |
| mask `#`, ignore `.@`                 | `... my email address is ##########@#######.###.`                           |
| crypto hash                           | `... my email address is 41D1567F7F99F1DC2A5FAB886DEE5BEE.` (key-dependent) |

- Mask example: on `My SSN is 111222333`, masking with `+` and `numberToMask` 6 gives
  `My SSN is ++++++333`. Source:
  <https://docs.cloud.google.com/sensitive-data-protection/docs/deidentify-sensitive-data>.
- Pseudonymization, from
  <https://docs.cloud.google.com/sensitive-data-protection/docs/pseudonymization>:
  - The surrogate annotation format is `SURROGATE_INFOTYPE(LENGTH):VALUE`. It lets a
    re-identify request find the tokens in free text.
  - Example HMAC output for `1-206-555-0123`:
    `XlTCv8h0GwrCZK+sS0T3Z8txByqnLLkkF4+TviXfeZY=`.
  - A context tweak means the same patient id maps differently per column. In the
    documented example, 43789 becomes 47222.
  - Comparison table: AES-SIV is reversible but not format-preserving; FPE-FFX is
    reversible and format-preserving; HMAC is irreversible.
- Date shifting, from
  <https://docs.cloud.google.com/sensitive-data-protection/docs/concepts-date-shifting>:
  - Bounds are ±100 days, and the shift is keyed per `user_id` context.
  - Within one user, 2009-06-09 becomes 2009-07-17 (+38), and 2010-11-03 becomes
    2011-01-26 (+84) in the second documented example.
- Bucketing, from
  <https://docs.cloud.google.com/sensitive-data-protection/docs/concepts-bucketing>:
  - Values map to Low/Medium/High ranges.
  - Generalizing a string can turn `Senior Engineer` into `Engineer`.

### Content and deployment

- Inputs are text, tables (records), images, and storage scans (Cloud Storage, BigQuery,
  Datastore and hybrid jobs). TIFF arrived in 2026. Sources:
  <https://docs.cloud.google.com/sensitive-data-protection/docs/concepts-images> and the
  release notes.
- Offsets are given as `byteRange` (UTF-8) and `codepointRange`; tables also carry a
  `recordLocation`. Source:
  <https://docs.cloud.google.com/java/docs/reference/google-cloud-dlp/latest/com.google.privacy.dlp.v2.Location>.
- Deployment is cloud only, with regional endpoints. There is no on-prem service.
- The service does not run secret validity checks against providers. Unverified: none
  are documented.

## 3. Azure AI Language PII and Microsoft Purview

- URL: <https://learn.microsoft.com/en-us/azure/ai-services/language-service/personally-identifiable-information/overview>.
- Pricing: per 1,000 text records, with a free tier. See
  <https://azure.microsoft.com/pricing/details/cognitive-services/language-service/>.
- Closed source. Containers can run disconnected under a commitment plan:
  <https://learn.microsoft.com/en-us/azure/ai-services/language-service/personally-identifiable-information/how-to/use-containers>.
- API versions: GA `2026-05-01` and preview `2026-05-15-preview`. Source:
  <https://learn.microsoft.com/en-us/azure/ai-services/language-service/personally-identifiable-information/how-to/redact-text-pii>.

### Entities

- About 182 entity types, by a manual count of
  <https://learn.microsoft.com/en-us/azure/ai-services/language-service/personally-identifiable-information/concepts/entity-categories>.
  The project's catalog has 176.
- `Password` must be requested explicitly through `piiCategories`. Same source.
- The `Subtype` field was removed from the 2024-11-01 API. Same source.
- Language support: many languages for general entities; country-specific IDs are
  locale-dependent. See
  <https://learn.microsoft.com/en-us/azure/ai-services/language-service/personally-identifiable-information/language-support>.

### Redaction policies

Source: <https://learn.microsoft.com/en-us/azure/ai-services/language-service/personally-identifiable-information/how-to/redact-text-pii>.

- `redactionPolicies` holds a default policy plus per-entity overrides. `policyKind` is
  one of:
  - `characterMask` (the default). Takes `redactionCharacter`, for example `*`.
  - `entityMask`. Example output: `[PERSON_1] received a call from [PHONENUMBER_1].`
  - `syntheticReplacement`. Example: `John Doe received a call from 424-878-9193.`
    becomes `Sam Johnson received a call from 401-255-6901.`
  - `noMask`. Detection only.
- `confidenceScoreThreshold` defaults to 0.9. It can be overridden per entity (for
  example SSN 0.8) and per entity and language (for example Person in `en` at 0.6).
- `disableEntityValidation` turns off checksum and format validation.

### Domain adaptation

Source: <https://learn.microsoft.com/en-us/azure/ai-services/language-service/personally-identifiable-information/how-to/adapt-to-domain-pii>.

- `entitySynonyms` adds a context word, for example `BAN` for
  InternationalBankAccountNumber.
- `valueExclusionPolicy` takes `caseSensitive` and `excludedValues`.
  - The documented input lists four garage addresses and excludes two of them.
  - Output: `...at **********, 1 Microsoft Way, Redmond, WA 98052,
********************************, and 1045 La Avenida St, Mountain View, CA 94043`.
  - The masked spans in the doc do not line up exactly with the input addresses. The
    doc example is internally inconsistent.
- Containers only: a regex rule file. Same source.
  - Patterns are `regexPatterns` entries `{id, pattern, matchScore, locales}`.
  - Context is `matchContext` hints `{hintText, boostingScore, contextLimit}`.
  - Example: `WeakSSNPattern` is `(?<!\d)([0-9]{9})(?!\d)` with matchScore 0.55;
    hints add 0.2.
  - Rule names need the `CE_` prefix, and patterns use .NET regex.

### Quickstart examples

Source: <https://learn.microsoft.com/en-us/azure/ai-services/language-service/personally-identifiable-information/quickstart>.

| Input                                                                      | Redacted text                                                              |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `Call our office at 312-555-1234, or send an email to support@contoso.com` | `Call our office at ************, or send an email to *******************` |
| `My SSN is 859-98-0987`                                                    | `My SSN is ***********`                                                    |
| `The employee's SSN is 859-98-0987.`                                       | `The ********'s SSN is ***********.` (PersonType `employee`)               |
| `My phone number is 555-555-5555`                                          | `My phone number is ************`                                          |

In the first example, the phone number is at offset 19, length 12, and the email at
offset 53, length 19.

Offsets are measured in the unit set by `stringIndexType`: `TextElement_v8` (the
default), `UnicodeCodePoint` or `Utf16CodeUnit`. Source:
<https://learn.microsoft.com/en-us/rest/api/language/analyze-text/analyze-text/analyze-text?view=rest-language-analyze-text-2026-05-01>.
Documents and conversations, including transcripts, have their own PII endpoints:
<https://learn.microsoft.com/en-us/azure/ai-services/language-service/personally-identifiable-information/how-to/redact-document-pii>.

### Microsoft Purview (brief)

- Sensitive information types (SITs) have a primary element plus supporting evidence
  within a character proximity window (for example 300 characters). Confidence is high,
  medium or low. Source:
  <https://learn.microsoft.com/purview/sit-sensitive-information-type-learn-about>.
- The SIT count (300+) is **unverified**. The entity definitions page is too large to
  count reliably.
- Detection feeds DLP policy actions such as block, audit or notify. Purview has no text
  transformation API.

## 4. AWS: Comprehend, Macie, CloudWatch Logs

### Comprehend PII

- URL: <https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html>. Pricing per unit
  of 100 characters. Closed source.
- Languages: English and Spanish. Real-time requests are limited to 100 KB. Source:
  <https://docs.aws.amazon.com/comprehend/latest/dg/realtime-pii-api.html>.
- Entities: 36 types, including the credential-like PASSWORD,
  AWS_ACCESS_KEY / AWS_SECRET_KEY, PIN and USERNAME. The documented PASSWORD example is
  `*very20special#pass*`. Source:
  <https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html>.
- `DetectPiiEntities` returns `Type`, `Score`, `BeginOffset` and `EndOffset` in
  characters. `ContainsPiiEntities` returns labels only. Source:
  <https://docs.aws.amazon.com/comprehend/latest/dg/realtime-pii-api.html>.
- Redaction runs only in async jobs. `RedactionConfig` has:
  - `MaskMode`: `MASK` or `REPLACE_WITH_PII_ENTITY_TYPE`.
  - `MaskCharacter`: one of `!@#$%&*`.
  - `PiiEntityTypes`.
  - Source: <https://docs.aws.amazon.com/comprehend/latest/APIReference/API_RedactionConfig.html>.
- Documented sample: `Hello Paulo Santos. The latest statement for your credit card
account 1111-0000-1111-0000 was mailed to 123 Any Street, Seattle, WA 98109.`
  - Findings: NAME 6-18 (score 0.99997), CREDIT_DEBIT_NUMBER 69-88 (0.89), ADDRESS 103-138.
  - Redacted: `Hello ***** ******. The latest statement for your credit card account
******************* was mailed to *** *** ******* ******** ** *****.`
  - The doc spells the name "Paul" in one place and "Paulo" in another.
  - Source: <https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html>.

### Macie

- Macie scans S3 objects only. Pricing per GB inspected plus bucket monitoring. Source:
  <https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html>.
- Managed identifiers include these credentials:
  - AWS_CREDENTIALS, GCP_API_KEY, HTTP_BASIC_AUTH_HEADER, HTTP_COOKIE, JSON_WEB_TOKEN.
  - Private keys: OpenSSH, PGP, PKCS and PuTTY.
  - STRIPE_CREDENTIALS.
  - Many personal and financial identifiers require a keyword nearby.
  - Source: <https://docs.aws.amazon.com/macie/latest/user/mdis-reference-quick.html>.
- Custom data identifiers combine a regex with optional keywords, ignore words and a
  maximum match distance. Source:
  <https://docs.aws.amazon.com/macie/latest/user/custom-data-identifiers.html>.
- Allow lists are documented at
  <https://docs.aws.amazon.com/macie/latest/user/allow-lists.html>.
  - A predefined-text list (stored in S3) matches exactly. A regex list must match the
    whole value.
  - Allowed matches are not reported.
  - Allow lists are not available in the Osaka Region.
- Macie does not transform content.

### CloudWatch Logs data protection

Source: <https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/mask-sensitive-log-data.html>.

- A policy has `Audit` and `Deidentify` statements. Data is masked at ingestion, and a
  principal with `logs:Unmask` sees the original.
- A policy allows up to 10 custom data identifiers, each with a regex of at most 200
  characters. Example: `EmployeeId-\d{9}`.
- Audit findings can go to CloudWatch, Firehose or S3.

## 5. GitHub secret scanning

- About page: <https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning>.
- What it scans: the full git history on all branches, plus issues, pull requests,
  discussions, wikis and secret gists.
- Pricing: free for public repositories. Private repositories need GitHub Secret
  Protection, a paid add-on for Team and Enterprise Cloud.
- Partner program: leaked partner secrets are reported to the provider.
- Validity checks may contact the provider to test a token. Source:
  <https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning>.
- Patterns: roughly 500 provider patterns, by a manual count of
  <https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns>.
- Non-provider patterns, from the same page:
  - ec_private_key, generic_private_key, openssh_private_key, pgp_private_key,
    rsa_private_key.
  - http_basic_authentication_header, http_bearer_authentication_header.
  - mongodb_connection_string, mysql_connection_url, postgres_connection_string.
- Copilot secret scanning detects generic passwords by AI. These alerts have no validity
  check. Same page.
- Custom patterns, from
  <https://docs.github.com/en/code-security/reference/secret-security/custom-patterns>:
  - Patterns use the Hyperscan regex dialect, a PCRE subset.
  - Limits: up to 500 patterns per organization or enterprise, 100 per repository.
  - Default boundaries: before the secret `\A|[^0-9A-Za-z]`; after it `\z|[^0-9A-Za-z]`.
  - Additional requirements: "must match" and "must not match" regexes.
  - A dry run covers up to 10 repositories and shows up to 1,000 results. Copilot can
    generate the regex.
- Documented custom-pattern example, from
  <https://docs.github.com/en/code-security/secret-scanning/using-advanced-secret-scanning-and-push-protection-features/custom-patterns/defining-custom-patterns-for-secret-scanning>:
  - Configuration:
    - Format `[$#%@AA-Za-z0-9]{5,10}`; after-secret `[^\.]`.
    - Must match `[A-Z]`, `[0-9]` and `[$%@!]`; must not match `[a-z]{2,}`.
  - Results:
    - Matches: `a9@AAfT!` gives `a9@AAfT`; `ee95GG@ZA942@aa` gives `@ZA942@a`;
      `a9@AA!ee9` gives `a9@AA`.
    - No match: `a9@AA.!`, `a@AAAAA`, `aa9@AA!ee9`, `aAAAe9`.
- 2026 changes:
  - 2026-03-10: new detectors and validity checks.
    <https://github.blog/changelog/2026-03-10-secret-scanning-pattern-updates-march-2026/>.
  - 2026-04-14: validity checks for custom patterns can be configured through the API.
  - 2026-06-17, 2026-07-07, 2026-07-15 and 2026-08-07: monthly pattern updates. The
    07-07 update added extended metadata and multipart validation. The per-month detector
    counts come from search snippets: **unverified**.
  - 2026-10-28: push protection for AI-detected generic secrets.
    <https://github.blog/changelog/2026-10-28-push-protection-beyond-predefined-secret-patterns>.
    - The classifier was built with Microsoft Applied Sciences.
    - It is in public preview, off by default, and consumes AI credits.
    - API fields: `secret_scanning_generic_secrets` and
      `secret_scanning_generic_secrets_push_protection`.

## 6. GitGuardian

- URL: <https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/supported_credentials>.
  Closed SaaS with a free tier for small teams. The `ggshield` CLI is open source but
  calls the API.
- Detector count is **unverified**. Secondary sources say 385+, 450+ and 550+.
  GitGuardian's State of Secrets Sprawl 2026 report says 105 detectors were added in
  2025: <https://www.gitguardian.com/state-of-secrets-sprawl-report-2026> (**unverified**
  direct page fetch).
- Specific detectors list "Validity Check Available" and "Only Valid Incidents Raised"
  flags. Same supported_credentials page.
- 19 generic detectors (same page):
  - Authentication Tuple, Base64 Basic Authentication, Base64 Generic High Entropy Secret
  - Basic Auth String, Bearer Token, Company Email Password
  - ConvertTo-SecureString Password, Curl Username Password, Generic CLI Secret
  - Generic Database Assignment, Generic Encryption Key, Generic High Entropy Secret
  - Generic Password, Generic Sanctum Token, Generic Terraform Variable Secret
  - JSON Web Token, ServiceNow Generic Password, Username Password, X-API-Key Secret
- Generic Password, from
  <https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/generics/generic_password>:
  - The variable name must contain pwd, passwd or password.
  - The assignment must use one of `:`, `=`, `||`, `=>`, `:=` or `<-`.
  - Banlists cover common passwords, placeholders, and context words such as
    `example` and `version`.
  - Caught: `password = lol123ok!`, `pwd = lol123ok!`, `passwd : lol123ok!`.
  - Not caught: `password = AESlol123ok!` (an encrypted prefix) and
    `example pwd = lol123ok!`.
- Generic High Entropy Secret, from
  <https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/generics/generic_high_entropy_secret>:
  - The variable must name a secret, token, api key, credential or auth.
  - The value must be roughly 16-1024 characters, with Shannon entropy of at least 3
    and at least 2 digits.
  - Caught: `api_key = hj65_klhz/trlupok76`.
  - Not caught:
    - Too short: `api_key = hj65_klhz/trlu`.
    - Low entropy: `secret = xob1xob1xob1xob1xob1xob1xob1`.
    - Wrong variable: `object_id = hj65_klhz/trlupok76`.
    - Encrypted prefix: `secret = aes.hj65_klhz/trlupok76`.
- Username Password, from
  <https://docs.gitguardian.com/secrets-detection/secrets-detection-engine/detectors/generics/username_password>:
  - Caught: `username: totolao    password: AStrangeWith1Char`.
  - Not caught: a username that is an email address, or a pair that is too far apart.
- Deployment: SaaS or a self-hosted Kubernetes edition; inputs are git, CI and chat
  integrations (**unverified**, not confirmed on a docs page during this research).

## 7. Nightfall

- URL: <https://help.nightfall.ai/>. `docs.nightfall.ai` now redirects there. Closed
  SaaS, priced per GB or per seat. Pricing is not public (**unverified**).
- Detectors:
  - About 150 rows in the detector glossary.
  - Categories: Common Entities, Documents, File Metadata, Finance, Hardware/Network,
    Healthcare, AI Safety, regional PII, and Secrets.
  - Marketing describes them as "150+ ML-based detectors".
  - Source: <https://help.nightfall.ai/llms-full.txt>.
- Confidence bands: Possible (40-75%), Likely (75-90%), Very Likely (90%+). Same source.
- Context rules, same source:
  - A regex is checked in a character window before or after the finding.
  - On a match, the confidence changes to Exclude, Possible, Likely or Very Likely.
- Exclusion rules: by regex (full or partial match), by dictionary (manual, existing or
  uploaded), and by file type. Same source.
- Detection rules combine detectors with Any/All logic, a minimum confidence, and a
  minimum number of findings. Same source.
- Redaction, from
  <https://help.nightfall.ai/developer-api/key-concepts/scanning_features/redaction>.
  Set exactly one of:
  - `maskConfig`, with:
    - `maskingChar`, `charsToIgnore`.
    - `numCharsToLeaveUnmasked` (0-1000). The doc also spells it
      `numCharsToLeaveUnMasked`.
    - `maskRightToLeft`.
  - `infoTypeSubstitutionConfig`: the replacement is `[DETECTOR_NAME]`.
  - `substitutionConfig`: `substitutionPhrase`.
  - `cryptoConfig`: RSA `publicKey`. Nightfall does not store the key, so only the
    customer can decrypt.
  - Overlapping findings collapse into one `[REDACTED BY NIGHTFALL]`.
- Documented redaction example (same page):
  - Input: `my ssn is 123-45-5555 and date of birth is 01/11/1995 and my credit card
number is  4242 4242 4242 4242 and my email is james@gmail.com.`
  - Output: `my ssn is *REDACTED* and date of birth is ??/??/??95 and my credit card
number is  [CREDIT_CARD_NUMBER] and my email is <RSA ciphertext>`.
  - Overlap example: `my date of birth is 03 23 4242 4242 4242 4242 amex` becomes
    `my date of birth is [REDACTED BY NIGHTFALL] amex`.
- Inputs are text, files (with OCR), and SaaS integrations such as Slack, Google Drive
  and GitHub. 2026 release notes add Taiwan detectors, a Forensic Search MCP server and
  endpoint agents (<https://help.nightfall.ai/llms-full.txt>).

## 8. Limina (formerly Private AI)

- URLs: <https://docs.private-ai.com/llms.txt>, which points to `docs.getlimina.ai`.
  Closed source, licensed as a self-hosted container that is stateless and keeps no data.
  The rebrand date is **unverified**.
- Coverage: 50+ entity types and 49+ languages. Some pages say 52 languages
  (**unverified** which is current).
- Accuracy modes: `standard`, `high`, `high_multilingual`. Source:
  <https://docs.getlimina.ai/configuration-and-operations/entity-detection-and-redaction/customizing-detection.md>.
- Redaction, from
  <https://docs.getlimina.ai/configuration-and-operations/entity-detection-and-redaction/customizing-redaction.md>:
  - `processed_text.type` is `MASK` (default character `#`), `MARKER` or `SYNTHETIC`.
  - Marker formats:
    - `ENTITY_TYPE`, `ALL_ENTITY_TYPES` (lists every overlapping label).
    - `UNIQUE_ENTITY_TYPE` (the default; numbered, for example `NAME_1`).
    - `UNIQUE_HASHED_ENTITY_TYPE`.
    - A custom template such as `-->UNIQUE_HASHED_ENTITY_TYPE<--`.
  - `coreference_resolution` is `heuristics`, `model_prediction` or `combined`. With it,
    a spelled-out `N-E-S-S-A J-O-N-S-S-O-N` gets the same `NAME_1` marker as
    `Nessa Jonsson`.
- Documented example (an Icarus Airways call transcript, same page):
  - MASK output: `Hi! This is ###############################. ...`.
  - MARKER output: ORGANIZATION_1, ORGANIZATION_2, DATE_INTERVAL_1, CONDITION_1 and NAME_1.
- Filters, from
  <https://docs.getlimina.ai/configuration-and-operations/entity-detection-and-redaction/customizing-detection.md>:
  - `ALLOW` takes a regex or list, for example `Canada|Brazil|Italy`.
  - `BLOCK` takes a regex plus an `entity_type`. Example: `Android|iPhone|Pixel` as
    CELL_TYPE.
  - `ALLOW_TEXT` exempts a section of text (version 3.7).
- Toll-free allow example (same page):
  - Input: `Call me at 438-555-7343 or at work at 1-800-555-1423`, with the allow
    pattern `(1-)?(800|888|877|866|855|844|833)-\d{3}-\d{4}$`.
  - Output: `Call me at [PHONE_NUMBER_1] or at work at 1-800-555-1423`.
  - The entity record has `stt_idx` 11, `end_idx` 23 and `end_idx_processed` 27: offsets
    are reported in both the original and the processed text. Label PHONE_NUMBER, score
    0.9093.
- Files: PDF, DOCX, XLSX, PPTX, CSV, JSON, XML, images, audio and DICOM. There is also
  gibberish detection. Source: <https://docs.private-ai.com/llms.txt>.

## 9. Skyflow Detect

- URL: <https://docs.skyflow.com/detect-overview/>. Closed SaaS bundled with the Skyflow
  data privacy vault.
- Coverage: 60 entity types and 40+ languages. Same page.
- Token types, from the Node SDK reference
  <https://raw.githubusercontent.com/skyflowapi/skyflow-node-sdk/HEAD/docs/api_reference.md>:
  - `VAULT_TOKEN`: stored and reversible. Can be format-preserving, a UUID or numeric;
    the doc shows `NAME_ABC123`.
  - `ENTITY_UNIQUE_COUNTER`: a numbered label.
  - `ENTITY_ONLY`: the type name only.
  - The token type can be overridden per entity.
- Rules, same reference:
  - `setAllowRegexList`: matches are always treated as entities.
  - `setRestrictRegexList`: matches are never treated as entities.
  - `Transformations.setShiftDays({min, max, entities})` shifts dates by a range.
- The SDK sample input is `My SSN is 123-45-6789 and my card is 4111 1111 1111 1111.`
  Source: skyflow-node-sdk `samples/detect-api/deidentify-text.ts`.
- Re-identification is controlled by vault RBAC. Same overview page.
- Files: documents, audio (bleep, silence or voice morph), and images (OCR and face
  masking). Same overview page.

## 10. Tonic Textual

- URL: <https://docs.tonic.ai/textual/>. Closed SaaS; a self-hosted licence is
  advertised (**unverified**).
- Entities: 44 built-in types. Source:
  <https://docs.tonic.ai/textual/entity-types/built-in-entity-types>.
- Handling per type is set by `generator_config`, with `generator_default` as the
  fallback. Values are `Redact`, `Synthesis` or `Off`; `GroupingSynthesis` exists for
  linked entities. Source:
  <https://tonic-textual-sdk.readthedocs-hosted.com/en/latest/redact/redacting_text.html>.
- `Redact` produces type placeholders with a short hash suffix, which stay consistent
  within a record. A record can be retained for 1-720 hours for re-identification. Same
  source.
- Examples (same source):
  - `My name is John, and today I am demoing Textual, a software product created by
Tonic` becomes `My name is [NAME_GIVEN_HI1h7], and [DATE_TIME_4hKfrH] I am demoing
Textual, a software product created by [ORGANIZATION_P5XLAH]`. Offsets: John 11-15,
    today 21-26, Tonic 79-84.
  - `John Smith is a person` becomes `[NAME_GIVEN_dySb5] [NAME_FAMILY_7w4Db3] is a person`.
- Also supports JSON and HTML redaction, files, and custom models (same SDK docs).

## 11. Protecto, Strac, Gretel

- **Protecto**, from <https://docs.protecto.ai/core-concepts/tokens-vs-formats> and
  <https://docs.protecto.ai/masking-apis/overview>:
  - The mask endpoint is `PUT /api/vault/mask`.
  - Token types are deterministic: `Text` (same length), `Numeric`, and `Special`
    (15-30 alphanumeric characters).
  - "Formats" for email, phone and URL keep their structure.
  - Unmasking is role-gated (**unverified**, third-party description).
- **Strac**: only marketing sources were found. They claim 100+ or 250+ detectors, a
  `redact_text` API, ML and OCR. All **unverified**; there is no public API reference.
  See <https://www.strac.io/>.
- **Gretel**: NVIDIA reportedly acquired it in March 2025 for a nine-figure sum, and its
  roughly 80 employees joined NVIDIA. NVIDIA did not officially confirm the terms.
  Source: <https://techcrunch.com/2025/03/19/nvidia-reportedly-acquires-synthetic-data-startup-gretel>.
  It is no longer an independent competitor.

## 12. Observability vendors

### Datadog Sensitive Data Scanner

- Sources: <https://docs.datadoghq.com/security/sensitive_data_scanner/> and
  <https://docs.datadoghq.com/security/sensitive_data_scanner/setup/telemetry_data/>.
- What it scans: logs, APM spans, RUM, events and LLM Observability traces; S3 for
  detection only; and code through Datadog Secret Scanning.
- Where it runs: in the cloud before indexing, or on-prem in the Observability Pipelines
  Worker.
- Actions:
  - Redact: a placeholder such as `[sensitive_data]`.
  - Partially redact: a chosen number of characters from the start or end.
  - Hash: a FarmHash 64-bit fingerprint of the UTF-8 bytes.
  - Mask: a reversible view for users with the "Data Scanner Unmask" permission.
- Keyword dictionary:
  - Keywords must appear within 30 characters before the match by default.
  - At most 20 keywords per rule.
  - camelCase attribute names are split into words for matching.
- Suppressions: exact match, starts with, or ends with.
- Attribute scoping: rules can include or exclude attributes.
- Sampling: a sampling rate of 10-99% disables obfuscation.
- Regex dialect: a PCRE2 subset; capture groups are not used.
- Library rules: "90+", from an undated blog post (**unverified**; the rule library page
  is rendered client-side). Machine-learning address detection is in preview.

### New Relic log obfuscation

Source: <https://docs.newrelic.com/docs/logs/ui-data/obfuscation-ui/>.

- Rules are named regex expressions. Only the capture groups are replaced.
- Actions: `MASK` (replaces characters with X) and `HASH_SHA256`.
- Built-in auto-masking covers credit cards and SSNs.
- The documented SSN regex is `(\d{3}[-\s\.]?\d{2}[-\s\.]?\d{4})`.
- Documented example: `The credit card number 4321-5678-9876-2345 belongs to user
user@email.com (born on 01/02/2003) with SSN 123-12-1234`.
  - The card number becomes a SHA-256 hash.
  - The birth date becomes `(born on XXXXXXXXXX)`.

### Splunk and Elastic (brief)

- Splunk: `props.conf` `SEDCMD` rewrites data at index time. Source:
  <https://help.splunk.com/en/splunk-enterprise/get-started/get-data-in/10.4/configure-event-processing/anonymize-data>.
  - Example: `SEDCMD-Anon = s/ss=\d{5}(\d{4})/ss=xxxxx\1/g s/cc=(\d{4}-){3}(\d{4})/cc=xxxx-xxxx-xxxx-\2/g`.
  - `transforms.conf` regex rewriting is the alternative.
- Elastic: the `redact` ingest processor uses grok patterns and replaces each match with
  `<NAME>`. Prefix and suffix are configurable. It needs a commercial licence. Source:
  <https://www.elastic.co/docs/reference/enrich-processor/redact-processor>.
  - `55.3.244.1 GET /index.html 15824 0.043` with `%{IP:client}` becomes
    `<client> GET /index.html 15824 0.043`.
  - A custom `GITHUB_NAME` pattern, `@%{USERNAME}`, produces
    `<GITHUB_NAME> the PR is ready for review`.
  - The `trace_redact` option marks redacted documents.

## 13. Sentry data scrubbing (Relay)

- Docs:
  - <https://docs.sentry.io/security-legal-pii/scrubbing/advanced-datascrubbing/>
  - <https://docs.sentry.io/security-legal-pii/scrubbing/server-side-scrubbing/>
  - <https://develop.sentry.dev/pii/types/>
- Implementation: the `relay-pii` crate in <https://github.com/getsentry/relay>, under
  the FSL-1.1-Apache-2.0 licence (source-available, converting to Apache 2.0 after two
  years).
- Rules (`relay-pii/src/config.rs`):
  - The `RuleType` enum has 19 variants: anything, pattern, imei, mac, uuid, email,
    ip, creditcard, iban, userpath, pemkey, url_auth, us_ssn, bearer, password,
    cookies, redact_pair, multiple, alias, plus `Unknown` for forward compatibility.
  - Built-in aliases (`builtin.rs`): @ip, @imei, @mac, @uuid, @email, @creditcard,
    @iban, @pemkey, @urlauth, @usssn, @userpath, @password, @bearer, @anything and
    @common, each with a `:replace`, `:mask`, `:hash` or `:remove` suffix.
- Methods (`redactions.rs`):
  - `remove`.
  - `mask`: every character becomes `*` (`processor.rs`).
  - `hash`: a keyed digest in uppercase hex. The test outputs are 40 hex characters,
    the length of a SHA-1 digest. The algorithm was not confirmed in the downloaded
    files (**unverified**).
  - `replace`: the default text is `[Filtered]`; the built-in rules use `[ip]`,
    `[email]` and similar.
- Selectors (same docs):
  - Wildcards: `**` (deep) and `*`.
  - Operators: `!`, `&&`, `||`.
  - Value types: `$string`, `$number`, `$http`, `$user`, `$frame`, `$error`, and others.
  - Exact paths such as `extra.'My Value'`.
  - "Safe Fields" exempt paths from default scrubbing.
- Default sensitive keys, from `regexes.rs` (`PASSWORD_KEY_REGEX`):
  `(?i)(password|secret|passwd|api[-_]key|apikey|auth|credentials|mysql_pwd|privatekey|private[-_]key|token[^\s]*[:=]|^otp$|^two[-_]factor$)`.
- Cookie names: `COOKIE_REGEX` covers sentrysid, sudo, su, session, __session,
  sessionid, user_session, symfony, phpsessid, fasthttpsessionid, mysession,
  irissessionid, _vercel_jwt, connect.sid, JSESSIONID, ASP.NET_SessionId,
  laravel_session, csrf, xsrf, _xsrf, _csrf, csrf-token, csrf_token, xsrf-token,
  xsrf_token, fastcsrf and _iris_csrf. Optional `__N` suffixes are allowed, and only
  the cookie value is replaced.
- Bearer tokens: `(?i)\b(Bearer\s+)([^\s]+)`. Only the token group is replaced.
- Unit tests in `builtin.rs` provide 75 input/output pairs; a selection is in the cases
  JSON. Examples:
  - `before 127.0.0.1 after` becomes `before [ip] after`.
  - `foo::1` is not an IP.
  - `ether 4a:00:04:10:9b:50` becomes `ether *****************` with @mac, or
    `ether [mac]` with @mac:replace.
  - `some iban: DE89370400440532013000!` becomes `some iban: [iban]!`.
  - `https://username:password@example.com/` becomes `https://[auth]@example.com/`.
  - `C:\Users\mitsuhiko\Desktop` becomes `C:\Users\[user]\Desktop`.

### Mapping to this project

`createSentryBeforeSend` (src/outbound.js) serializes the whole event with
`JSON.stringify`, sanitizes the text, and returns `JSON.parse` of the result. On any
error it returns `null`. The project's detection is broader than Relay's, but it lacks
these Relay configuration features:

| Relay feature                                            | Project status                                               |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| Selector paths (`**`, `$http`, `!`, `&&`)                | Absent; only normalized field names via `fields`             |
| Per-rule method (`@email:hash`, `@ip:mask`)              | `transformations[type]` exists; no rule-to-method shorthand  |
| `remove` (drop the field)                                | Absent; values are replaced, not removed                     |
| Capture-group-only replacement (cookie, bearer, urlauth) | Partial via span detection; no user-level group replacement  |
| Safe Fields allowlist                                    | Absent as a path allowlist                                   |
| `[ip]` / `[email]`-style type placeholders               | Possible through callbacks; not a built-in mode              |
| Mask that keeps length (`*` per character)               | `mask` keeps a prefix/suffix; full-length masking unverified |

## 14. LLM gateways and guardrails

### Cloudflare (Zero Trust DLP and AI Gateway DLP)

- Predefined DLP profiles, from
  <https://developers.cloudflare.com/cloudflare-one/data-loss-prevention/dlp-profiles/predefined-profiles/>:
  - Credentials and Secrets: 7 entries, including checksum-validated Cloudflare tokens.
  - Financial Information: 12 entries, Luhn-validated.
  - National Identifiers: 14 entries.
  - Health Information: FDA drug names and ICD codes.
  - Source Code: 12 languages, detected by NLP.
  - Five AI Prompt profiles that classify content and intent.
  - PII Record: fires when 3 or more unique PII entries appear close together.
  - Unsanitized HAR files.
- AI Gateway DLP, from <https://developers.cloudflare.com/ai-gateway/features/dlp/> (last
  updated 2026-10-12):
  - Scans request and response bodies. Streamed responses are buffered first.
  - Actions:
    - Pass.
    - Flag: sets a `cf-aig-dlp` header.
    - Block: returns HTTP 400.
  - There is no redaction.

### Portkey (now Prisma AIRS AI Gateway)

- Source: <https://portkey.ai/docs/product/guardrails/pii-redaction>. The site banner
  reads "Portkey is now PRISMA AIRS AI Gateway", a Palo Alto Networks product.
- Categories: phone, email, location, IP, SSN, names and credit cards. It applies to
  requests and responses.
- Numbered placeholders: `Hi, you can reach me at john@example.com or 555-0123` becomes
  `Hi, you can reach me at {{EMAIL_ADDRESS_1}} or {{PHONE_NUMBER_1}}`.
- Custom regex: `My SSN is 123-45-6789 and credit card is 4532-1234-5678-9012` becomes
  `My SSN is [SSN_REDACTED] and credit card is [CREDIT_CARD]`.

### Lakera Guard (Check Point AI Guardrails)

- Ownership: Check Point announced the acquisition on 2025-09-16. The price, about
  $300M, is reported (**unverified**). The product is now "Check Point AI Guardrails".
  Source: <https://www.checkpoint.com/press-releases/> (**unverified** exact URL).
- Data leakage prevention, from <https://docs.lakera.ai/docs/data-leakage-prevention.md>:
  - 8 PII detectors: full names, US addresses, US phone numbers, email, IP, credit card,
    IBAN and US SSN.
  - Custom regex detectors and system-prompt leakage detection.
  - Projects run in Detect mode or Enforce mode.
  - Masking uses the offsets returned with `"payload": true`. Source:
    <https://docs.lakera.ai/docs/api/guard.md>.
- The docs list explicit positive and negative examples per detector. All of them are in
  the cases JSON. Negatives include:
  - Names: single names (`Louise`) and the placeholders `John Doe` / `Jane Doe`.
  - Addresses: non-US addresses such as `Bahnofstrasse 23, 8001, Zurich, Switzerland`.
  - IPs: `::1`, `8.8.8.8`, `127.0.0.1` and `257.168.0.1`.
  - Cards: Luhn failures such as `4111-1111-1111-1112`.
  - SSNs: reserved ranges such as `999-45-6789`, `666-45-6789` and `000-62-8144`.

## 15. Feature comparison against this project

The project's current features, from [docs/API.md](../../../API.md):

- Transformations: `redact` (default), `hive-mask`, `mask` (`keepStart`/`keepEnd`),
  `pseudonym` (HMAC-SHA256), `format-preserving`, `fake`, `date-shift` and `bucket`.
  The `format-preserving` mode is a keyed shape pseudonym, not NIST FF1 encryption.
- Callback transformations per type.
- Reversible `Person-1` placeholders.
- Confidence and likelihood scores, with `minConfidence` defaulting to 0.5.
- Rule, type and field policies.
- `knownOnly` mode.
- Report adapters with utf16, codepoint and byte offsets.
- Explicit-label recognition of the Google, Azure and AWS entity catalogs.

| Capability                                  | Google | Azure     | AWS            | Nightfall | Limina | Skyflow | Tonic     | Datadog  | Sentry              | This project                              |
| ------------------------------------------- | ------ | --------- | -------------- | --------- | ------ | ------- | --------- | -------- | ------------------- | ----------------------------------------- |
| Full redaction / fixed text                 | Yes    | -         | -              | Yes       | -      | -       | -         | Yes      | Yes                 | Yes                                       |
| Replace with type name                      | Yes    | Yes       | Yes            | Yes       | Yes    | Yes     | -         | -        | Yes                 | Via callback                              |
| Numbered type markers (`PERSON_1`)          | -      | Yes       | -              | -         | Yes    | Yes     | -         | -        | -                   | Yes (Person-1)                            |
| Hash-suffixed markers                       | -      | -         | -              | -         | Yes    | -       | Yes       | -        | -                   | No                                        |
| Character mask, full length                 | Yes    | Yes       | Yes            | Yes       | Yes    | -       | -         | -        | Yes                 | Unverified                                |
| Mask: N characters / keep N / direction     | Yes    | -         | -              | Yes       | -      | -       | -         | Yes      | -                   | keepStart/End                             |
| Mask: characters to ignore                  | Yes    | -         | -              | Yes       | -      | -       | -         | -        | -                   | No                                        |
| Dictionary replacement                      | Yes    | -         | -              | -         | -      | -       | -         | -        | -                   | `pools` (fake)                            |
| Synthetic / fake values                     | -      | Yes       | -              | -         | Yes    | -       | Yes       | -        | -                   | Yes                                       |
| Keyed hash                                  | Yes    | -         | -              | -         | Yes    | -       | -         | FarmHash | Yes (40-hex digest) | HMAC-SHA256                               |
| Reversible encryption (FPE / AES-SIV / RSA) | Yes    | -         | -              | RSA       | -      | Vault   | Retention | Unmask   | -                   | No                                        |
| Date shift                                  | Yes    | -         | -              | -         | -      | Yes     | -         | -        | -                   | Yes                                       |
| Bucketing                                   | Yes    | -         | -              | -         | -      | -       | -         | -        | -                   | Yes                                       |
| Hotword / context likelihood adjustment     | Yes    | Container | Macie keywords | Yes       | -      | -       | -         | Yes      | -                   | Built-in only                             |
| Exclusion dictionary / regex                | Yes    | Yes       | Macie          | Yes       | Yes    | Yes     | -         | Yes      | Safe fields         | `publicEntities` (exact, evidence-backed) |
| Block list with type                        | Yes    | -         | -              | -         | Yes    | Yes     | -         | -        | -                   | Known values                              |
| Per-entity thresholds                       | -      | Yes       | -              | Yes       | -      | -       | -         | -        | -                   | Global only                               |
| Offsets in processed text                   | -      | -         | -              | -         | Yes    | -       | -         | -        | -                   | No                                        |
| Validity check against provider             | -      | -         | -              | -         | -      | -       | -         | -        | -                   | No (offline)                              |

In the table, "-" means the feature is not documented. The project column comes from
docs/API.md. "Partial" and "Unverified" mean that matching feature was not confirmed in
the project docs during this research. Vendor cells come from the sources in sections
2-14.

### Gaps worth noting

1. The catalogs were out of date: 213 Google names and 176 Azure types on
   `main`. This branch has 214 Google and 180 Azure names. A recount on
   2026-11-10 of every `UPPER_SNAKE` identifier on the Google infoType
   reference page found no infoType missing from the vendored list. The only
   extra identifiers were `ANY_LOCATION`, sensitivity levels and country
   names. The earlier estimate of about 265 Google infoTypes was too high.
   Sources: sections 2 and 3.
2. There is no true reversible format-preserving encryption. Google's FFX/FPE and
   AES-SIV with surrogate annotations are the reference design.
3. Masking options are narrower than Google's `characterMaskConfig` and Nightfall's
   `maskConfig`. Missing: `charactersToIgnore`, `numberToMask`, and the direction flag.
4. There are no user-configurable hotword or exclusion rules with windows and
   full/partial matching. These exist in Google, Nightfall, Datadog, Macie, Azure
   containers and Limina.
5. Thresholds cannot be set per entity or per language. Azure supports both.
6. There are no marker templates (`ALL_ENTITY_TYPES`, hashed markers, custom
   delimiters such as `{{EMAIL_ADDRESS_1}}`).
7. Sentry integration lacks Relay-style selectors, safe fields, and `remove`.
8. Results do not give offsets in the processed text.

## 16. Notes on verification

- Entity and detector counts change often and were counted by hand from the pages on
  2026-11-10. Treat them as approximate.
- The GitGuardian total, the Datadog library size, the Strac claims, the Purview SIT
  count, the Lakera acquisition price and the Limina rebrand date are **unverified**.
- Doc inconsistencies found:
  - AWS spells the sample name both "Paul" and "Paulo".
  - Azure's value-exclusion example masks spans that do not match its input.
  - Nightfall spells `numCharsToLeaveUnmasked` two ways.
  - Lakera lists `Goerge Mller` as an intentional typo example.
