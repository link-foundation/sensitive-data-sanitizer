# Detection coverage and limits

Coverage is a union of maintained detectors, explicit known values, context and conservative native rules. Detection is heuristic; there is no claim of perfect recall, universal anonymity, or superiority over every competitor.

## Credential coverage

The native provider supplements in `src/rules.js` cover GitHub, GitLab, OpenAI, Anthropic, AWS access IDs, Google API/OAuth, Slack, Stripe, SendGrid, Twilio, npm, PyPI, Telegram, Discord, Hugging Face, Shopify, Databricks, Square, Mailchimp, DigitalOcean, Vault, Grafana, Linear, Notion, Vercel, and JWT-shaped values. Prefix matches also protect selected truncated tokens; they do not validate a token with a provider.

The default native engine bundles 221 text rules from Gitleaks 8.30.1 (222 upstream rules; the path-only PKCS12 rule is outside text detection), compiled unchanged with RE2/WASM. The MIT license, commit and sync script are retained in `src/vendor/gitleaks`. Keyword prefilters and configured entropy thresholds run natively; upstream comment/path allowlists cannot suppress a sanitizer finding. Quoted hex/base64 entropy detection supplements those rules. The default asynchronous engine additionally uses the pinned Secretlint recommended scanners, excluding its comment-filter rule. Embedded disable directives in untrusted text cannot suppress findings. Optional Gitleaks and TruffleHog invoke their installed detector sets, and custom detectors can add formats. Service counts are not a measure of comparative recall.

Context rules recognize credential labels with bounded key affixes, JSON and nested escaped JSON, YAML/env/INI assignments, shell flags, XML values, URL userinfo, authorization headers, cookies, webhook paths, and complete or truncated private-key PEM blocks. Low-entropy contextual values such as `password=1234` are protected. Generic token counters, booleans/null/language literals and ordinary Git hashes are excluded to retain useful logs. Supply literal known values for ambiguous credentials or unusual key names.

Broader unquoted entropy scanning is opt-in (`paranoid: true`), uses Shannon entropy ≥4.2 on bounded candidates, and exempts ordinary hex hashes and common tool identifiers. Quoted hex/base64 and entropy checks belonging to bundled provider rules run by default. Entropy has both false positives and false negatives; contextual detection and known-secret dictionaries remain necessary.

## Personal data and languages

Native rules cover international/Unicode emails, international and selected national-format phones, Luhn-valid payment cards, US SSNs, IPv4/IPv6, checksum-validated IBAN/CPF/Spanish DNI/US NPI, Indian PAN, UK NI, wallet shapes, MACs, messenger handles, home usernames, labelled PII and selected postal address grammars. A bundled 17-locale name gazetteer supplies default free-text detection, including selected inflections/transliterations. Each locale has credential prose and eight labelled PII fixtures. This finite dictionary/grammar is not unrestricted statistical NER; unfamiliar names and unsupported national formats require known values or additional recognizers.

Credential labels have fixtures for 17 language variants:

| Language            | Example credential label |
| ------------------- | ------------------------ |
| English             | password                 |
| Portuguese          | senha                    |
| Spanish             | contraseña               |
| French              | mot_de_passe             |
| German              | passwort                 |
| Russian             | пароль                   |
| Simplified Chinese  | 密码                     |
| Traditional Chinese | 密碼                     |
| Japanese            | パスワード               |
| Korean              | 비밀번호                 |
| Arabic              | كلمة المرور              |
| Hebrew              | סיסמה                    |
| Hindi               | पासवर्ड                  |
| Turkish             | şifre                    |
| Indonesian          | kata_sandi               |
| Vietnamese          | mật_khẩu                 |
| Thai                | รหัสผ่าน                 |

These are tested label patterns, not 17 complete NER language models. `src/locales.js` and `src/rules.js` define the exact vocabulary. Unicode NFKC, combining marks, common invisible/bidi controls, ANSI escapes and JSON Unicode escapes are projected to a detection view with original offset mapping. Original delimiters/content outside redactions remain intact. NFKC does not equate every homoglyph or transliteration.

The optional [Presidio bridge](../examples/presidio-bridge.py) accepts `--language` and `--model` for separately installed spaCy models. [Presidio's multilingual guide](https://presidio.dataprivacystack.org/tutorial/05_languages/) explains that models and recognizers must be configured per language. Installing one English model does not provide every language. There is no runtime model download. Offline public classification uses bundled sourced entries and documented role/domain heuristics. Callers can add reviewed exact policies or explicitly enable Wikidata verification; known-private values and credential overlaps always retain private treatment.

## Identity and additional credential formats

Native MRZ extraction covers TD1/TD2/TD3 and MRV-A/MRV-B, including standalone
name/data fragments and bounded whitespace reflow. Check digits raise confidence;
invalid checks do not allow MRZ through. Country passport shapes include Russian
domestic/international, US/UK, German, Indian, Korean and Italian documents.
Ambiguous bare nine-digit values receive lower confidence and redact under the publication profile.
Travel labels protect PNR/booking references, 13-digit tickets and visa numbers.
Birth-date vocabulary supports numeric and English/Russian month-name dates.

Native country types: UK_NHS, KR_RRN, IT_FISCAL_CODE, SG_NRIC_FIN, PL_PESEL,
SE_PERSONNUMMER, ZA_ID_NUMBER, AU_TFN, CA_SIN, RU_SNILS and RU_INN. Checks validate
format arithmetic, not issuance; modern Korean RRNs may use randomized suffixes,
so damaged/non-legacy checks still receive contextual or shape coverage. Bare
checksum-only numeric formats receive low confidence (usually 0.35) and are
inspectable but unchanged under the default 0.5 personal threshold. Specific
structures and identity/health context supply stronger evidence. Card detection
requires a supported network prefix and length as well as Luhn; timestamp
contexts and epoch-shaped numbers are negatives.
Messenger/call context adds RU/VN/TH/ID national trunk-prefix phone shapes.

Confirmed names and strong personal values propagate within a document and
across later streaming batches, including filename/path occurrences and bounded
Cyrillic/ICAO/GOST/common spelling aliases. Russian patronymics, capitalized or
all-caps Slavic surname pairs in either order, and two/three-part names adjacent
to document filename words supplement the gazetteer. Late confirmations and
registry exhaustion block completed stream publication; see [API.md](API.md).

### National-ID defaults

Scores below apply to valid reported shapes outside timestamp/order metadata.
Default API personal threshold is 0.5; publication profile/CLI redact use 0.3.
Identity/health labels generally raise checksum-valid scores to 0.99 and damaged
checks to 0.9. These scores indicate rule strength, not issuance or probability.

| Type/shape                                    | Bare score | API default  | Publication profile |
| --------------------------------------------- | ---------- | ------------ | ------------------- |
| UK_NHS, spaced or compact                     | 0.35       | Inspect only | Replace/mask        |
| KR_RRN, plausible date and checksum           | 0.99       | Replace      | Replace/mask        |
| IT_FISCAL_CODE, alphanumeric structure        | 0.99       | Replace      | Replace/mask        |
| SG_NRIC_FIN, prefix and check letter          | 0.99       | Replace      | Replace/mask        |
| PL_PESEL, valid checksum                      | 0.35       | Inspect only | Replace/mask        |
| SE_PERSONNUMMER, valid formatted checksum     | 0.35       | Inspect only | Replace/mask        |
| ZA_ID_NUMBER, valid checksum                  | 0.35       | Inspect only | Replace/mask        |
| AU_TFN, valid spaced/compact checksum         | 0.35       | Inspect only | Replace/mask        |
| CA_SIN, valid spaced/compact checksum         | 0.35       | Inspect only | Replace/mask        |
| RU_SNILS, `ddd-ddd-ddd dd` / `ddd ddd ddd dd` | 0.99       | Replace      | Replace/mask        |
| RU_SNILS, compact checksum only               | 0.35       | Inspect only | Replace/mask        |
| RU_INN, 12 digits/two checks                  | 0.99       | Replace      | Replace/mask        |
| RU_INN, 10 digits/one check                   | 0.35       | Inspect only | Replace/mask        |

Russian SNILS contexts include СНИЛС, пенсионное, страховое свидетельство and
страховой номер. English passport contexts include series and number, passport
series and document number. Unlabelled Russian passport shapes retain their
0.4 score and are protected by the publication profile. Numeric-noise exclusions
continue to preserve timestamps, order IDs and routine tool identifiers.

Credential rules add complete netrc triplets, NuGet oy2 keys, all eight WordPress
key/salt constants and complete/truncated PuTTY v2/v3 private blocks. Streaming
holds netrc/PuTTY blocks across chunks. Placeholder exclusions do not override
known secrets. [The requirement matrix](case-studies/repository-issue-13/REQUIREMENTS.md)
records standards, alternatives and regression coverage for each feature.

## Bounds and unsupported inputs

| Boundary              | Behavior                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Input                 | 10 MiB CLI bytes / 10 Mi UTF-16 library units by default; configurable                                |
| Normalized projection | Hard cap of 10 Mi UTF-16 units; exceeding it blocks analysis                                          |
| Encoded candidates    | 8,192 raw characters per decoded run; audited redaction for longer runs; 4,096 candidates, two layers |
| Directory             | 10,000 files; `.git` and `node_modules` omitted                                                       |
| Findings              | 100,000 hits; exceeding the limit blocks analysis                                                     |
| Local subprocess      | Default 30 seconds and 10 MiB report/stdout cap; failures block output                                |
| Git objects           | 10,000 objects, 10 MiB per object and 100 MiB total by default                                        |

Supported decoding includes canonical base64/base64url, line-wrapped base64, hex, percent, HTML entities, UTF-8 byte escapes and JSON string escapes, with fatal UTF-8 checks. Opt-in encoding preservation round-trips sanitized payloads; nested escaped JSON retains its structure by default. Arbitrarily split fragments, unlimited nesting, compressed/encrypted payloads, malformed encodings, archives, PDFs, OCR/images and non-UTF-8 files are outside this text profile. Whole-input/candidate limits fail; oversized textual percent/base64 runs receive audited complete-run redaction. Unsupported representations may remain undetected. `decode: false` intentionally reduces coverage. A caller needing another format should decode it through a bounded preprocessing adapter and retain correct original spans.

Default text mode can replace JSON numeric values with string markers and change syntax/types. Opt-in structured JSON/JSONL mode scans string keys/values separately, preserves primitive types, and rejects malformed output or key collisions. Numeric personal values need a separate caller schema policy. Existing quoted JSON strings and escaped-string fixtures retain their delimiters. Review sanitized artifacts for their intended consumer.

An unchanged result is not proof that text contains no sensitive information. The original sensitive input, private config, scanner reports, temporary files during execution, backups, screenshots, and remote caches remain separate handling concerns. POSIX permissions do not create equivalent Windows ACL guarantees or secure memory/disk erasure. In-place replacement creates a new file; it does not preserve ownership metadata, ACLs, or guarantee crash durability of the directory entry.

## Entity catalogs and optional modes

Documented Google/Azure/AWS catalog names (213/176/36) are recognized as explicit native labels, including canonical underscore and original camel-case forms. Generic DATE is excluded so ordinary headers/calendar dates remain intact; personal birth-date context still qualifies. This vocabulary is distinct from automatic vendor NLP/image/cloud-service features. Typed transformations and confidence are described in [API.md](API.md); full redaction remains the default. Public Wikidata names, known role/domain emails and public resolver/documentation IPs use explicit offline knowledge and heuristics. Opt-in network lookup does not establish identity; private overrides and credential priority remain authoritative.

Large UTF-8 logs use bounded record streaming and worker file publication. Whole-string default limits remain unchanged. The review corpus benchmark is a finite, synthetic regression comparison; [method, settings and results](../experiments/benchmark/README.md) explain its scope. It does not demonstrate general market-wide superiority.

Structured JSONL streaming supports 8 MiB records and ordered record workers;
[issue 24 evidence](case-studies/issue-24/README.md) records the 7 MiB regression
and reproducible throughput measurement. Realistic fake mode preserves supported
scripts/formats/checksums and uses reserved contact ranges where available.
Generated identities are pseudonyms; valid arithmetic does not prove non-issuance.
