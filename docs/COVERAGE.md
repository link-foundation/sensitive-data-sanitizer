# Detection coverage and limits

Coverage is a union of maintained detectors, explicit known values, context and conservative native rules. Detection is heuristic; there is no claim of perfect recall, universal anonymity, or superiority over every competitor.

## Credential coverage

The native provider supplements in `src/rules.js` cover GitHub, GitLab, OpenAI, Anthropic, AWS access IDs, Google API/OAuth, Slack, Stripe, SendGrid, Twilio, npm, PyPI, Telegram, Discord, Hugging Face, Shopify, Databricks, Square, Mailchimp, DigitalOcean, Vault, Grafana, Linear, Notion, Vercel, and JWT-shaped values. Prefix matches also protect selected truncated tokens; they do not validate a token with a provider.

The default asynchronous engine additionally uses the pinned Secretlint recommended scanners, excluding its comment-filter rule. Embedded disable directives in untrusted text cannot suppress findings. Optional Gitleaks and TruffleHog invoke their installed detector sets, and custom detectors can add formats. Service counts are not a measure of comparative recall.

Context rules recognize credential labels with bounded key affixes, JSON and nested escaped JSON, YAML/env/INI assignments, shell flags, XML values, URL userinfo, authorization headers, cookies, webhook paths, and complete or truncated private-key PEM blocks. Low-entropy contextual values such as `password=1234` are protected. Generic token counters, booleans/null/language literals and ordinary Git hashes are excluded to retain useful logs. Supply literal known values for ambiguous credentials or unusual key names.

Entropy scanning is opt-in (`paranoid: true`), uses Shannon entropy ≥4.2 on bounded candidates, and exempts ordinary hex hashes and common tool identifiers. It has both false positives and false negatives; contextual detection and known-secret dictionaries remain necessary.

## Personal data and languages

Native rules cover international/Unicode email addresses, international phone forms with a leading `+`, Luhn-valid payment card numbers, structurally valid US SSNs, IPv4/IPv6 addresses, and labelled names/addresses/birth dates/IDs. National phone formats, country-specific identifier validators, unrestricted names/organizations in prose, and semantic addresses require appropriate recognizers or supplied known values.

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

These are tested label patterns, not 17 complete NER language models. `src/rules.js` defines the exact vocabulary. Unicode NFKC, combining marks, common invisible/bidi controls, ANSI escapes and JSON Unicode escapes are projected to a detection view with original offset mapping. Original delimiters/content outside redactions remain intact. NFKC does not equate every homoglyph or transliteration.

The optional [Presidio bridge](../examples/presidio-bridge.py) accepts `--language` and `--model` for separately installed spaCy models. [Presidio's multilingual guide](https://presidio.dataprivacystack.org/tutorial/05_languages/) explains that models and recognizers must be configured per language. Installing one English model does not provide every language. There is no runtime model download. Public-person/organization/contact exceptions require exact caller-reviewed policy entries with HTTPS evidence; there is no automated popularity or web lookup.

## Bounds and unsupported inputs

| Boundary              | Behavior                                                                              |
| --------------------- | ------------------------------------------------------------------------------------- |
| Input                 | 10 MiB CLI bytes / 10 Mi UTF-16 library units by default; configurable                |
| Normalized projection | Hard cap of 10 Mi UTF-16 units; exceeding it blocks analysis                          |
| Encoded candidates    | 8,192 characters per run, 256 accepted candidates per decoding invocation, two layers |
| Directory             | 10,000 files; `.git` and `node_modules` omitted                                       |
| Findings              | 100,000 hits; exceeding the limit blocks analysis                                     |
| Local subprocess      | Default 30 seconds and 10 MiB report/stdout cap; failures block output                |
| Git objects           | 10,000 objects, 10 MiB per object and 100 MiB total by default                        |

Supported decoding includes canonical base64/base64url, line-wrapped base64, hex and percent encoding, with fatal UTF-8 checks. Arbitrarily split fragments, unlimited nesting, compressed/encrypted payloads, malformed encodings, archives, PDFs, OCR/images and non-UTF-8 files are outside this text profile. Limit violations fail; unsupported representations may remain undetected. `decode: false` intentionally reduces coverage. A caller needing another format should decode it through a bounded preprocessing adapter and retain correct original spans.

Redacting a JSON numeric value with a string marker can change syntax or types; this is text sanitization, not a schema-preserving JSON anonymizer. Existing quoted JSON strings and escaped-string fixtures retain their delimiters. Review sanitized artifacts for their intended consumer.

An unchanged result is not proof that text contains no sensitive information. The original sensitive input, private config, scanner reports, temporary files during execution, backups, screenshots, and remote caches remain separate handling concerns. POSIX permissions do not create equivalent Windows ACL guarantees or secure memory/disk erasure. In-place replacement creates a new file; it does not preserve ownership metadata, ACLs, or guarantee crash durability of the directory entry.
