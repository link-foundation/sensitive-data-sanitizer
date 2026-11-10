# Open-source PII, anonymization and log-redaction competitors (issue #128)

Research date: 2026-11-10. Scope: open-source tools that detect and redact or
anonymize personal data (PII/PHI) in free text, structured data, and logs.
Pure secret scanners (gitleaks, TruffleHog, detect-secrets, ...) are out of
scope here and covered by a separate research note.

Companion file: `open-source-pii-cases.json` (371 cases, 136 negative), schema
`{"tool","source","input","sensitive":[exact substrings],"types":[...],"negative":bool,"notes"}`.
Every `sensitive` entry was checked to be a literal substring of `input`, and
the Presidio, scrubadub, LLM Guard, OpenRedaction, redact-pii and Phileas strings
were checked against the downloaded upstream files. DataFog cases are
imported directly from its span-annotated corpus, and each span offset was checked.
All personal data in the cases is the fake/sample data shipped by upstream projects.

Conventions:

- "(unverified)" marks claims taken from a README or description that I did not
  confirm in source or tests.
- Star counts, versions and dates come from the GitHub API, PyPI JSON API, npm
  registry and Hugging Face API, all queried on 2026-11-10.

Previous competitor list: `docs/case-studies/issue-1/COMPETITORS.md` (Presidio
2.2.364 and scrubadub 2.0.1 were benchmarked there).

---

## 1. Summary table

| Tool                                       | Lang                               | License                                   | Latest version (date)                                                                       | Stars                     | Detection                                                 | Reversible                             |
| ------------------------------------------ | ---------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------- | -------------------------------------- |
| Microsoft/data-privacy-stack Presidio      | Python                             | MIT                                       | 2.2.366 (2026-10-27)                                                                        | 11.8k                     | regex+checksum+context+NER/LLM                            | yes (encrypt/decrypt, deanonymize)     |
| scrubadub                                  | Python                             | Apache-2.0 (GitHub) / MIT (PyPI metadata) | 2.0.1 (2023-09-01)                                                                          | 432                       | regex + optional spaCy/Stanford NER                       | no (hash labels only)                  |
| DataFog datafog-python                     | Python (+opt. Rust)                | MIT                                       | 4.9.0 (2026-09-29)                                                                          | 80                        | regex, spaCy, GLiNER, cascade                             | no                                     |
| LLM Guard (Protect AI)                     | Python                             | MIT                                       | 0.3.16 (2025-05-19)                                                                         | 3.2k                      | Presidio + BERT NER + regex                               | yes (Vault + Deanonymize)              |
| Philter / Phileas (philterd)               | Java                               | Apache-2.0                                | Philter 4.0.1 (2026-11-03), Phileas 4.4.0 (2026-09-03)                                      | 67 / 111                  | regex+checksum, dictionaries, NER (Ph-Eye)                | yes (encrypt, FPE)                     |
| OpenRedaction                              | TypeScript                         | MIT                                       | npm 1.1.5 (2026-07-26)                                                                      | 107                       | 570+ regex + validators + context                         | yes (redactionMap/restore)             |
| redact-pii (solvvy)                        | TypeScript                         | MIT                                       | 3.4.0 (2024-11-19)                                                                          | 217                       | regex + name dictionary + heuristics, optional Google DLP | no                                     |
| @redactpii/node                            | TypeScript                         | MIT                                       | 1.0.19 (2026-09-28)                                                                         | 6                         | regex + greeting heuristics                               | no                                     |
| pii-codex                                  | Python                             | BSD-3-Clause                              | 0.6.1 (2026-02-15)                                                                          | 102                       | Presidio wrapper + risk scoring                           | no                                     |
| pino redact / fast-redact / @pinojs/redact | JS                                 | MIT                                       | pino 10.4.0 (2026-10-02), fast-redact 3.5.0 (2024-03-19), @pinojs/redact 0.4.0 (2026-07-29) | 18.3k / 339 / 31          | key paths (no content scan)                               | no                                     |
| piiranha-v1                                | model (mDeBERTa)                   | CC-BY-NC-ND-4.0                           | HF, modified 2025-11-01                                                                     | 249 likes, 158k downloads | token classification                                      | n/a                                    |
| GLiNER PII models                          | model                              | Apache-2.0 / NVIDIA OML                   | gliner 0.2.30 (2026-10-31)                                                                  | -                         | zero-shot span NER                                        | n/a                                    |
| openai/privacy-filter                      | model + Python/JS                  | Apache-2.0                                | repo created 2026-04-17                                                                     | 2.8k                      | MoE token classifier                                      | n/a                                    |
| Rehydra                                    | TypeScript                         | MIT                                       | npm rehydra 0.16.5 (2026-11-01)                                                             | 103                       | regex + ONNX NER                                          | yes (AES-GCM PII map)                  |
| flare-redact                               | TypeScript                         | MIT                                       | npm 1.6.1 (2026-08-09)                                                                      | 52                        | regex + key names + entropy                               | keyed pseudonyms                       |
| cloakrs                                    | Rust (+Python)                     | MIT                                       | crate 0.4.0 (2026-09-29)                                                                    | 60                        | regex + validators                                        | yes (mapping.json restore)             |
| pii-shield                                 | Go                                 | Apache-2.0                                | -                                                                                           | 179                       | entropy + regex + key names                               | no (deterministic hash)                |
| censgate/redact                            | Rust                               | Apache-2.0                                | -                                                                                           | 23                        | regex + NER                                               | (unverified)                           |
| PasteGuard                                 | TypeScript (Bun) + Python detector | Apache-2.0                                | pushed 2026-11-08                                                                           | 822                       | GLiNER + python-stdnum + secret rules                     | yes (placeholder restore in responses) |
| packyme/privacy-filter                     | Go                                 | MIT                                       | pushed 2026-06-09                                                                           | 338                       | regex + gitleaks rules + entropy                          | no                                     |

Sources: GitHub repo API (`gh api repos/<owner>/<repo>`), https://pypi.org/pypi/<name>/json,
`npm view <pkg>`, https://huggingface.co/api/models/<id>.

---

## 2. Microsoft Presidio

- Repo: https://github.com/data-privacy-stack/presidio (moved from `microsoft/presidio`; the old URL redirects). MIT.
- Docs: https://microsoft.github.io/presidio/
- Packages: presidio-analyzer and presidio-anonymizer 2.2.366 (2026-10-27), presidio-structured 0.0.10,
  presidio-image-redactor 0.0.62 (PyPI).

### Detection

- `AnalyzerEngine` runs a registry of recognizers. There are about 140 predefined recognizer classes under
  `presidio-analyzer/presidio_analyzer/predefined_recognizers/` (country folders: us, uk, es, it, pl, fi,
  in, sg, au, kr, th, ca, ng, se, de, ...) plus generic ones (credit card, crypto, email, IBAN, IP, MAC,
  URL, phone, date, UUID).
  https://github.com/data-privacy-stack/presidio/tree/main/presidio-analyzer/presidio_analyzer/predefined_recognizers
- Recognizer kinds:
  - `PatternRecognizer`: regex, deny list and per-pattern score, with an optional `validate_result`
    checksum (Luhn, mod-97 IBAN, Verhoeff Aadhaar, mod-11 NHS, PESEL, ABA, SIN, TFN/ABN, ...) and an
    `invalidate_result` hook.
  - `EntityRecognizer`, wrapping NLP engines: spaCy, Stanza, HuggingFace transformers, and GLiNER
    (`GLiNERRecognizer`).
  - LLM-based recognizer through LangExtract (`LangExtractRecognizer`; docs "LLM-based recognizers").
  - Remote recognizers (Azure AI Language, AWS Comprehend).
    https://microsoft.github.io/presidio/analyzer/adding_recognizers/
- Every result has a score in [0, 1]. The `LemmaContextAwareEnhancer` raises the score when context words
  (e.g. "ssn", "card") appear near the match. `score_threshold` filters results.
  https://microsoft.github.io/presidio/analyzer/context/
- Allow lists (`allow_list`, with `allow_list_match="exact"|"regex"`), ad-hoc recognizers passed per
  request (REST: `ad_hoc_recognizers`), and YAML recognizer configuration.
  https://microsoft.github.io/presidio/analyzer/analyzer_engine_provider/
- Multi-language: recognizers declare `supported_language`. Context words are per language (e.g. the
  CA SIN test uses French "NAS" and the TH TNIN test uses Thai context).
- `BatchAnalyzerEngine` / `BatchAnonymizerEngine` for lists and dicts.
- Text normalization: the test suite contains full-width and zero-width-character cases where offsets
  are mapped back to the original string (tests dir, `test_text_normalizer*`). (Exact file name unverified.)
- Decision process / explanations: `return_decision_process=True` returns why each span was scored.
  https://microsoft.github.io/presidio/analyzer/decision_process/

### Anonymization operators

https://microsoft.github.io/presidio/anonymizer/

| Operator          | Behavior                                            |
| ----------------- | --------------------------------------------------- |
| replace           | `new_value`, default `<ENTITY_TYPE>`                |
| redact            | removes the text                                    |
| hash              | sha256 / sha512 (md5 removed); salted               |
| mask              | `masking_char`, `chars_to_mask`, `from_end`         |
| encrypt / decrypt | AES-CBC with a 128/192/256-bit key (reversible)     |
| custom            | lambda per entity                                   |
| keep              | keeps value but records span                        |
| surrogate_ahds    | Azure Health Data Services surrogates (fake values) |

- `DeanonymizeEngine` reverses `encrypt`. The docs also show an "instance counter" custom operator for
  consistent `<PERSON_0>` tokens. https://microsoft.github.io/presidio/samples/python/pseudonomyzation/
- presidio-structured: anonymizes pandas DataFrames and JSON, inferring per-column/key entity types.
  https://microsoft.github.io/presidio/structured/
- presidio-image-redactor: OCR (Tesseract or Azure Document Intelligence) + analyzer, then draws boxes.
  It also handles DICOM medical images (burned-in text).
  https://microsoft.github.io/presidio/image-redactor/
- Deployment: Python library, Docker REST services (analyzer/anonymizer/image), Spark samples. Fully offline
  once models are downloaded.

### Selected test cases (full list in JSON, 99 Presidio cases)

Tests live under https://github.com/data-privacy-stack/presidio/tree/main/presidio-analyzer/tests

| File                                         | Input                                                            | Expected                                   | Pos/Neg |
| -------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------ | ------- |
| test_credit_card_recognizer.py               | `4012888888881881 4012-8888-8888-1881 4012 8888 8888 1881`       | 3 CREDIT_CARD                              | pos     |
| test_credit_card_recognizer.py               | `4012-8888-8888-1882`                                            | Luhn fails                                 | neg     |
| test_crypto_recognizer.py                    | `bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297` | CRYPTO (bech32m)                           | pos     |
| test_crypto_recognizer.py                    | `16Yeky6GMjeNkAiNcBY7ZhrLoMSgg1BoyZ2`                            | checksum fails                             | neg     |
| test_us_ssn_recognizer.py                    | `abc 078 05 1123 abc`                                            | `078 05 1123`                              | pos     |
| test_us_ssn_recognizer.py                    | `693-09.4444`, `078-05-0000`, `666000000`, `123-45-6789`         | mixed separators / invalid groups / sample | neg     |
| test_iban_recognizer.py                      | `this is an iban VG96 VPVG 0000 0123 4567 8901 in a sentence`    | the IBAN                                   | pos     |
| test_iban_recognizer.py                      | `AL47 212A 1009 0000 0002 3569 8741`                             | letter in numeric BBAN                     | neg     |
| test_in_aadhaar_recognizer.py                | `3123:4567:8909`                                                 | Verhoeff                                   | pos     |
| test_fi_personal_identity_code_recognizer.py | `My finnish id code is030594W903B.`                              | `030594W903B`                              | pos     |
| test_th_tnin_recognizer.py                   | `เลขประจำตัวประชาชน: 3456789012347`                              | TH_TNIN                                    | pos     |
| test_ca_sin_recognizer.py                    | `mon NAS: 258 933 688`                                           | CA_SIN                                     | pos     |
| test_ip_recognizer.py                        | `Connect to [2001:db8::1]:8080`                                  | `2001:db8::1`                              | pos     |
| test_ip_recognizer.py                        | `fe80::1%eth0`                                                   | IPv6 with zone id                          | pos     |
| test_mac_recognizer.py                       | `FF:FF:FF:FF:FF:FF`, `00:00:00:00:00:00`, `10:2F:33-AC-29-C3`    | broadcast/zero/mixed                       | neg     |
| test_url_recognizer.py                       | `my domains: microsoft.com google.co.il`                         | bare domains are URLs                      | pos     |
| test_email_recognizer.py                     | `user@xn--80ak6aa92e.com`                                        | punycode                                   | pos     |
| test_date_recognizer.py                      | `2024-06-05T09:15:30.500-07:00`                                  | DATE_TIME                                  | pos     |
| test_uuid_recognizer.py                      | `Request ID: 550e8400-e29b-41d4-a716-446655440000`               | UUID                                       | pos     |

Note the conflict with DataFog, which treats `Trace id 550e8400-...` as a negative.

---

## 3. scrubadub (+ scrubadub_spacy)

- Repo: https://github.com/LeapBeyond/scrubadub, Apache-2.0 LICENSE (the PyPI classifier says MIT).
  Version 2.0.1 (2023-09-01); no release since.
- scrubadub_spacy: https://github.com/LeapBeyond/scrubadub_spacy, 2.0.0 (2021-09-30), last push 2023-09.
- Docs: https://scrubadub.readthedocs.io/

### Features

- Architecture: `Scrubber` -> `Detector`s -> `Filth` objects -> `PostProcessor`s -> replacement text.
  https://scrubadub.readthedocs.io/en/latest/usage.html
- Detectors:
  - credentials, credit card, date of birth, drivers licence (GB), email, NINO, phone, postal code,
    SSN, tax reference number (UK TRN), Twitter, Skype, URL, vehicle licence plate (GB)
  - optional: address (pyap/postal), spaCy / Stanford / Stanza NER for names, orgs and locations,
    `TextBlob` name detector
  - `UserSuppliedFilthDetector` for known PII lists (exact strings)
- Locales: detectors are locale-aware (`locale='en_GB'`, `'en_US'`, `'de_DE'`, ...). Phone numbers use
  `phonenumbers` with the locale's region.
- Post-processors:
  - `FilthReplacer` with `include_hash=True, hash_salt=..., hash_length=...` produces stable tokens.
    Docs example: `'contact me on <b>PHONE-DB92D</b> or <b>EMAIL-028CC</b>'`
    (https://github.com/LeapBeyond/scrubadub/blob/master/docs/usage.rst).
  - Incremental labels (`EMAIL-0`, `EMAIL-1`), `PrefixSuffixReplacer`, `FilthTypeReplacer`, `RemoveReplaced`.
- Comparison/benchmark utilities: `scrubadub.comparison` can generate fake documents with
  Faker and compute precision/recall per detector.
  https://scrubadub.readthedocs.io/en/latest/accuracy.html
- No structured data, image, CLI, server or streaming support. Fully offline.

### Selected cases (28 in JSON)

Source: https://github.com/LeapBeyond/scrubadub/tree/master/tests

| File                             | Input                                         | Expected                                     |
| -------------------------------- | --------------------------------------------- | -------------------------------------------- |
| test_detector_credentials.py     | `login snoop pw biggreenhat`                  | `snoop`, `biggreenhat`                       |
| test_detector_credentials.py     | `This is your problem`                        | negative                                     |
| test_detector_date_of_birth.py   | `I was born 15th June 1991`                   | DOB (context word needed)                    |
| test_detector_date_of_birth.py   | `DOB: 02.12.1979`                             | only `1979` redacted (documented limitation) |
| test_detector_drivers_licence.py | `MORGA 753 116 SM91J 01`                      | GB driving licence                           |
| test_detector_email.py           | `john at gmail.com`                           | obfuscated email                             |
| test_detector_skype.py           | `contact me on skype (dean.malmgren) to chat` | `dean.malmgren`                              |
| test_detector_postalcode.py      | `95130-642`                                   | negative                                     |

---

## 4. DataFog (datafog-python)

- Repo: https://github.com/DataFog/datafog-python (default branch `dev`), MIT, v4.9.0 (2026-09-29).
- README: https://github.com/DataFog/datafog-python/blob/dev/README.md

### Features

- Engines:
  - `regex` (default, no ML dependencies)
  - `spacy`
  - `gliner` (zero-shot GLiNER models)
  - `smart`, a cascade: regex first, then GLiNER/spaCy for names, orgs and locations
- Entity types: EMAIL, PHONE, SSN, CREDIT_CARD, IP_ADDRESS, DATE, ZIP_CODE, plus PERSON/ORG/LOCATION from
  NER. German locale pack (opt-in `locales=["de"]`) adds DE_TAX_ID, DE_VAT_ID and DE_IBAN.
- Presidio-style entity aliases are accepted (e.g. `EMAIL_ADDRESS` -> `EMAIL`). (README)
- `allowlist` (exact strings) and `allowlist_patterns` (regex that must match the whole span). The test
  `tests/test_allowlist.py` suppresses the ten-digit timestamp `1783025668`, which is otherwise detected as
  PHONE, using `^\d{10}$`.
- Anonymizer: REPLACE gives `[EMAIL_1]`-style numbered tokens, REDACT gives `[REDACTED]`, and HASH supports
  MD5/SHA256/SHA3_256.
- CLI: `datafog scan-text`, `redact-text`, `replace-text`, `hash-text`.
- LLM-agent integrations: a Claude Code hook and a LiteLLM guardrail (README).
- Changes in 4.9: OCR (Tesseract/Donut) and Spark integrations are deprecated. An opt-in Rust backend
  provides the regex engine. (CHANGELOG/README; exact performance claims unverified.)

### Test corpus

`tests/corpus/{structured_pii,negative_cases,edge_cases}.json` has 107 cases with `type,text,start,end`
spans and is ideal for direct import. All but the empty and 100 kB cases are in the JSON file.
https://github.com/DataFog/datafog-python/tree/dev/tests/corpus

Notable negatives, all designed against over-matching:

- `The book ISBN is 978-3-16-148410-0`
- `Part number: 555-123-4567-A`
- `Build id 0x7f00ff00 is not an IP address`
- `Release v2026.2.9 fixed the issue`
- `Trace id 550e8400-e29b-41d4-a716-446655440000`
- `Sequence 1234 5678 90 is not a card`
- `const EMAIL_PATTERN = /[a-z]+@[a-z]+/;`
- `Date 2026-99-99 is not valid`
- `https://example.com/@user/profile is a URL path`

Notable edge cases:

- adjacent PII without a separator: `john@acme.com123-45-6789` gives EMAIL + SSN
- already-redacted tokens must not be re-redacted: `User [EMAIL_1] already masked`,
  `Value is <REDACTED> and should not re-redact`, and a block-character mask
- JSON-escaped and nested JSON values
- Markdown code blocks
- a code identifier `const john_example_com = true;` (negative)
- `Value 2020-01-01.1 is malformed`, which yields only the DATE and no IP
- CJK name, accented name, and Arabic text around a phone number

---

## 5. LLM Guard (Protect AI)

- Repo: https://github.com/protectai/llm-guard, MIT. 0.3.16 (2025-05-19, PyPI); last commit 2026-07-08.
- Docs: https://protectai.github.io/llm-guard/

### Anonymize / Deanonymize / Sensitive

- `Anonymize` input scanner (https://protectai.github.io/llm-guard/input_scanners/anonymize/):
  - Built on Presidio analyzer with transformer NER models (`BERT_BASE_NER_CONF`, `BERT_LARGE_NER_CONF`,
    DeBERTa-v3 AI4Privacy, and a Chinese config) plus extra regex patterns in
    `llm_guard/input_scanners/anonymize_helpers/regex_patterns.py`.
  - The extra patterns cover CREDIT_CARD_RE, UUID, EMAIL_ADDRESS_RE (including `[AT]`/`[DOT]`
    obfuscation), US_SSN_RE, BTC_ADDRESS, URL_RE, CRYPTO, PO_BOX_RE and PHONE_NUMBER_ZH.
  - Placeholders are `[REDACTED_<TYPE>_<n>]`. Originals are stored in a `Vault` object.
  - Options: `hidden_names` (always redact as CUSTOM), `allowed_names`, `entity_types`,
    `use_faker` (replace with Faker values), `preamble`, `threshold`, `language` ("en"/"zh").
- `Deanonymize` output scanner restores vault values. Matching strategies are `exact`, `case_insensitive`,
  `fuzzy` (fuzzysearch) and `combined`, so an LLM that slightly alters a placeholder still gets restored.
  https://protectai.github.io/llm-guard/output_scanners/deanonymize/
- `Sensitive` output scanner detects PII in model output and can redact it (`<EMAIL_ADDRESS>`).
- `Secrets` input scanner wraps Yelp detect-secrets with about 95 custom plugins. `redact_mode` can be
  `partial`, `all` or `hash`. https://protectai.github.io/llm-guard/input_scanners/secrets/
- Server: `llm-guard-api` (FastAPI). Offline after model download; ONNX runtime optional.

### Selected cases (16 in JSON)

Source: https://github.com/protectai/llm-guard/tree/main/tests

- `test_anonymize.py`:
  - The SQL-insert prompt with `John Doe`, `test@test.com`, `hello@test.com`, `555-123-4567`,
    `192.168.1.100`, `4567-8901-2345-6789` and hidden name `Test LLC` becomes `[REDACTED_PERSON_1]`,
    `[REDACTED_EMAIL_ADDRESS_1]`, `[REDACTED_EMAIL_ADDRESS_2]`, `[REDACTED_CREDIT_CARD_RE_1]`,
    `[REDACTED_CUSTOM_1]`.
  - The resume test redacts the name, `john.doe@protectai[DOT]com`, `(123) 456-7890`, the SSN and the
    card. It intentionally keeps `April 12, 1990`, the street address, and `CVV: 123`.
  - `Full Name: Mary.` is unchanged with `allowed_names=["Mary"]` (negative).
- `test_secrets.py`:
  - `https://username:password@llm-guard.com` becomes `https://username:******@llm-guard.com`
    (only the password part is masked).

---

## 6. Philter and Phileas (philterd)

- Philter: https://github.com/philterd/philter, Apache-2.0, 4.0.1 (2026-11-03). Java 25 API server,
  Docker images, AWS/GCP/Azure marketplace listings. https://philterd.ai/
- Phileas (the engine library): https://github.com/philterd/phileas, Apache-2.0, 4.4.0 (2026-09-03).
- Docs: https://philterd.github.io/phileas/ and https://philterd.github.io/philter/ (structure unverified).

### Features

- Policies are JSON documents listing identifiers. Each identifier has filter strategies, conditions,
  ignore lists, and an optional dictionary or regex. PhiSQL is a compact policy language, e.g.
  `REDACT EMAIL_ADDRESS WITH REDACT;` (Phileas README).
- Filter strategy constants, verified in
  https://github.com/philterd/phileas/blob/main/phileas-core/src/main/java/ai/philterd/phileas/services/strategies/AbstractFilterStrategy.java:
  - `REDACT` (default format `{{{REDACTED-%t}}}`), `RANDOM_REPLACE` (fake values), `STATIC_REPLACE`,
    `MAP_REPLACE`, `SAME`
  - `CRYPTO_REPLACE` (encrypt), `FPE_ENCRYPT_REPLACE` (format-preserving encryption), `HASH_SHA256_REPLACE`
  - `LAST_4`, `MASK`, `TRUNCATE` (with `LEADING`/`TRAILING`), `ABBREVIATE`
  - dates: `SHIFT` (date shifting), `RELATIVE` ("3 months ago"), `TRUNCATE_TO_YEAR`
  - replacement scope `DOCUMENT` or `CONTEXT`
- Condition operators (same file): `token`, `context`, `confidence`, `birthdate`/`deathdate`, `startswith`,
  `==`, `!=`, `>`, `<`, `>=`, `<=`, `is`, `is not`. Examples are redacting ZIP codes only below a population
  or ages only above N. (Population condition from docs; unverified.)
- Consistent replacement within a "context" (document set), so the same name maps to the same surrogate
  across documents.
- Disambiguation between SSN and phone number for ambiguous 9-10 digit strings, using context vectors.
  (Docs; unverified in tests.)
- Validators: Luhn (cards), mod-11, mod-23 letter, mod-97 IBAN, BIC structure, German Personalausweis and
  Steuer-ID, Spanish CIF, VIN check digit.
- Identifier types: age, bitcoin address, bank routing, credit card, date, driver's license, email,
  IBAN, IP, MAC, passport, phone, phone extension, SSN/TIN, state abbreviation, street address,
  tracking number (UPS/FedEx/USPS), URL, VIN, ZIP. Dictionaries cover cities, counties, first names,
  surnames, hospitals and states. NER uses Ph-Eye (GLiNER over HTTP, or local ONNX).
- Input: plain text and PDF (PDF redaction produces images or a new PDF). The Philter API has
  `/api/filter`, `/api/explain` (span details), and contexts.
- Offline/self-hosted. No CLI in the Philter repo (API only). A separate `philter-cli` exists
  (unverified current status).

### Selected cases (12 Phileas + 1 Philter in JSON)

Source: https://github.com/philterd/phileas/tree/main/phileas-core/src/test/java/ai/philterd/phileas/filters

- BitcoinAddressFilterTest:
  - `127NVqnjf8gB9BFAW2dnQeM6wqmy1gbGtv` is detected.
  - `12qnjf8FAW2dnQeM6wqmy1gbGtv` is also detected (no Base58Check, unlike Presidio).
  - Uppercase bech32 is detected.
- IbanCodeFilterTest: `bank code of AV01AZ ok?` gives 0 spans with validation and 1 span without.
- TrackingNumberFilterTest: UPS `1Z9YF1280343418566` and USPS `9400 1000 0000 0000 0000`.
- VinFilterTest: `the vin is JB3BA36KXHU036784.` is detected (span 11-28); `11131517191X11111` is rejected
  by the check digit.

---

## 7. OpenRedaction

- Repo: https://github.com/sam247/openredaction, MIT, npm `openredaction` 1.1.5 (2026-07-26).
- Monorepo `packages/core`; site https://openredaction.com (hosted AI tier is separate; the core is offline).

### Features

- More than 570 regex patterns grouped by region and industry. Pattern packs include Middle East (UAE
  Emirates ID, Saudi ID/Iqama, Israeli Teudat Zehut), digital identity (Discord, Steam, social handles,
  Facebook IDs), healthcare, finance and government. (README; count unverified by me.)
- Validators: Luhn, IBAN mod-97, UK NINO prefix/suffix rules, NHS mod-11, SSN area/group/serial rules,
  sort code, email, and a name validator that rejects "Company Limited", weekdays and months.
  https://github.com/sam247/openredaction/blob/main/packages/core/tests/validators.test.ts
- Context analysis: many patterns need context keywords (`Discord user ID:`, `Steam profile:`).
- False-positive filter (`isFalsePositive`) suppresses:
  - version strings, repeated or sequential digits, and "test/example/sample" keywords
  - generic dates without DOB context, IPs in "server at" context, ports, percentages, prices
  - measurements (`150 cm`, `1920 px`) and years
    It also normalizes separators, including NBSP.
    Tests: `pattern-hardening.test.ts`, `false-positive-filter.test.ts`.
- Compliance presets: `gdpr`, `hipaa`, `ccpa`, `pci-dss`, `soc2`, and others.
- Redaction modes (`redaction-modes.test.ts`):
  - `placeholder`, e.g. `[EMAIL_1234]`
  - `mask-middle`: `555-***-4567`, `***-**-6789`, `j***@example.com`
  - `mask-all`
  - `format-preserving`: `XXX-XX-XXXX`, `(XXX) XXX-XXXX`, `xxxx@xxxxxxx.xxx`
  - `token-replace`, which produces realistic fake values
- Reversibility: the result has a `redactionMap`, and `restore()` reverses it.
- Custom patterns, whitelist, confidence scores, and audit logging. Streaming and an Express middleware
  are mentioned in the README (unverified in tests).

### Selected cases (53 in JSON)

Source: https://github.com/sam247/openredaction/tree/main/packages/core/tests

| File                              | Input                                                                        | Result                                                            |
| --------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| detector.test.ts                  | `Candidate #1.1: Joseph Barchi and Joseph Hallaren / Blue`                   | 2 NAME                                                            |
| detector.test.ts                  | `Card: 1234567890123456`                                                     | negative (Luhn)                                                   |
| validators.test.ts                | `FR1420041010050500013M02606`                                                | IBAN valid                                                        |
| validators.test.ts                | `BG123456C`, `GB123456C`, `NK123456C`, `AB123456E`                           | NINO invalid                                                      |
| digital-identity-patterns.test.ts | `Discord user ID: 123456789012345678` vs `Random number: 123456789012345678` | pos / neg                                                         |
| digital-identity-patterns.test.ts | `Email: @company.com`                                                        | not a handle                                                      |
| middle-east-patterns.test.ts      | `Emirates ID: 784-1990-1234567-1` vs `ID: 123-1990-1234567-1 in context`     | pos / neg                                                         |
| middle-east-patterns.test.ts      | `Iqama number: 2123456789` vs `Phone: 1234567890`                            | pos / neg                                                         |
| false-positive-filter.test.ts     | `build 10.15.7`, `height 150 cm`, `created on 2024-01-15`                    | neg                                                               |
| README                            | `Contact Sarah Jones at sarah@example.com or call +1 202-555-0110`           | `Contact S***h J***s at s***@example.com or call +1 ***-***-0110` |

---

## 8. redact-pii (solvvy) and @redactpii/node

- redact-pii: https://github.com/solvvy/redact-pii (default branch `main`), MIT, npm 3.4.0 (2024-11-19).
  Last push 2023-08-31, so it is effectively unmaintained but still widely depended upon.
- Built-ins: https://github.com/solvvy/redact-pii/blob/main/src/built-ins/simple-regexp-patterns.ts
  - Regexes: creditCardNumber, streetAddress, zipcode, phoneNumber, ipAddress, usSocialSecurityNumber,
    emailAddress, url.
  - `username` is `/(user( ?name)?|login): \S+/gi` and `password` is `/(pass(word|phrase)?|secret): \S+/gi`;
    both replace the key as well as the value. There is also a `credentials` pattern.
  - `digits` is `/\b\d{4,}\b/g`, which catches any run of four or more digits.
  - Names come from a well-known-names dictionary plus greeting and sign-off heuristics ("Hi", "Dear",
    "Thanks", "All the best").
- API: `SyncRedactor`, `AsyncRedactor`, `globalReplaceWith`, per-type `replaceWith`, enable/disable
  built-ins, and `customRedactors.before/after` regexes or functions. An optional `GoogleDLPRedactor`
  calls the Cloud API, which is not offline.
- Known weaknesses visible in tests:
  - No Luhn check (`1234 5678 8765 4321` is a card).
  - An unseparated SSN `123456789` falls to DIGITS.
  - A 9-group IPv6 string is accepted.
- README vs tests: the README shows `NAME`, but the tests expect `PERSON_NAME`.

### Selected cases (35 in JSON)

Source: https://github.com/solvvy/redact-pii/blob/main/test/redactor.test.ts

- `Hey it's David Johnson with ACME Corp. Give me a call at 555-555-5555` becomes
  `Hey it's PERSON_NAME with ACME Corp. Give me a call at PHONE_NUMBER`.
- `here's my Cliff. blah blah` is unchanged, but `here's my Clifford. blah blah` gives PERSON_NAME.
- `blah blah\n\n\nAll the best,\n\n--Meg C.\n\nAcme Support` becomes `--PERSON_NAME`. `Acme Support` alone
  is negative.
- `I live at 123 Park Ave Apt 123 New York City, NY 10002` becomes `I live at STREET_ADDRESS New York City, NY ZIPCODE`.
- Street-suffix negatives: `There is no way that I will pay for that circle in court`.
- `user: thislibrary\npass: 1$d0P3!` becomes `USERNAME\nPASSWORD`.
- `codeA: 123, codeB: 6789` becomes `codeA: 123, codeB: DIGITS`.
- `complex http://user@pass:example.com:8080/reset/password/12345?foo=bar&hi=there#/app works?` gives a URL.

### @redactpii/node

- https://github.com/wrannaman/redactpii-node, MIT, 1.0.19 (2026-09-28), 6 stars.
- Detects names (only after a greeting), email, US phone, cards and SSN. Provides `redactObject` and `hasPII`.
- README: `'Hi David Johnson, call 555-555-5555'` becomes `'Hi PERSON_NAME, call PHONE_NUMBER'`.
  `redactObject` leaves a bare `'John Doe'` field unredacted.

---

## 9. pii-codex

- https://github.com/EdyVision/pii-codex, BSD-3-Clause, v0.6.1 (2026-02-15).
- A wrapper around Presidio (and optionally Azure/AWS) that maps each detected type to a risk level and to
  HIPAA, DHS and NIST categories. It computes collection-level statistics: mean risk score, risk
  distribution, and a population-level PII summary.
  https://github.com/EdyVision/pii-codex/blob/main/README.md
- Its value is research analytics (risk scoring of social-media corpora), not redaction. No new test
  inputs were extracted.

---

## 10. Log-redaction libraries: pino, fast-redact, @pinojs/redact

- pino: https://github.com/pinojs/pino, MIT, 10.4.0 (2026-10-02).
  Redaction docs: https://github.com/pinojs/pino/blob/main/docs/redaction.md
- fast-redact: https://github.com/davidmarkclements/fast-redact, MIT, 3.5.0 (2024-03-19).
- @pinojs/redact: https://github.com/pinojs/redact, MIT, 0.4.0. pino 10.x `package.json` depends on
  `@pinojs/redact` instead of fast-redact. The pino redaction docs still mention fast-redact (observed
  2026-11-10).

Features:

- Redaction is path-based, not content-based:
  - `redact: ['key', 'path.to.key', 'stuff.thats[*].secret', 'path["with-hyphen"]']`
  - wildcards can be terminal (`a.*`), intermediate (`*.password`, in @pinojs/redact) or array (`[*]`)
  - paths are case-sensitive
- `censor` can be a string or a function `(value, path) => ...`. Default is `[Redacted]` in pino and
  `[REDACTED]` in fast-redact/@pinojs/redact.
- `remove: true` deletes keys instead of censoring them.
- fast-redact compiles paths into a function. It mutates the object and then restores it after
  serialization.
- @pinojs/redact uses "selective cloning", leaving the original object unchanged (README:
  `obj.headers.cookie` is still `'secret-session-token'`). `serialize: false` returns the object.
  `strict` controls whether primitives throw.
- Docs example: with paths `['key','path.to.key','stuff.thats[*].secret']`, the output keeps
  `"another":"thing"` and `"logme":"will be logged"` and replaces the others with `[Redacted]`.

Relevance: these define the "structured log by key name" baseline. Content-scanning tools (Presidio,
OpenRedaction) do not do this natively. flare-redact and pii-shield combine both approaches.

---

## 11. NER models

| Model                             | URL                                                                                    | License                          | Notes                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| piiranha-v1                       | https://huggingface.co/iiiorg/piiranha-v1-detect-personal-information                  | CC-BY-NC-ND-4.0 (non-commercial) | mDeBERTa-v3. 17 types (account number, building number, city, card, DOB, driver's license, email, first/last name, ID card, password, SSN, street, tax number, phone, username, zip). 6 languages (en, it, fr, de, nl, es). 256-token context. Model card claims 98.27% PII recall and F1 of 93.12%.                                                                                                             |
| GLiNER multi PII                  | https://huggingface.co/urchade/gliner_multi_pii-v1                                     | Apache-2.0                       | Zero-shot: labels passed at inference time. 99k downloads.                                                                                                                                                                                                                                                                                                                                                       |
| knowledgator/gliner-pii-base-v1.0 | https://huggingface.co/knowledgator/gliner-pii-base-v1.0                               | Apache-2.0                       | 2025-09                                                                                                                                                                                                                                                                                                                                                                                                          |
| nvidia/gliner-PII                 | https://huggingface.co/nvidia/gliner-PII                                               | NVIDIA Open Model License        | Based on GLiNER large-v2.1. 55+ entity types. Example: username `johndoe88`, `(555) 123-4567`, `johnd@example.com`.                                                                                                                                                                                                                                                                                              |
| openai/privacy-filter             | https://github.com/openai/privacy-filter, https://huggingface.co/openai/privacy-filter | Apache-2.0                       | 2026. Sparse MoE token classifier (about 1.5B total / 50M active parameters), 128k context, BIOES tags with constrained Viterbi decoding. 8 labels: account_number, private_address, private_email, private_person, private_phone, private_url, private_date, secret. Runs in the browser through transformers.js. 103k downloads. Example: `My name is Harry Potter and my email is harry.potter@hogwarts.edu.` |

spaCy-based anonymizers: apart from Presidio's spaCy engine and scrubadub_spacy, I found no maintained
standalone spaCy anonymizer with more than about 50 stars (`gh search repos "spacy anonymization"`,
2026-11-10).

The piiranha source/training GitHub repo was not checked (unverified).

---

## 12. Notable newer projects (2025-2026)

| Project                | URL                                              | Lang                       | Notable features (README; not test-verified)                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rehydra                | https://github.com/rehydra-ai/rehydra-sdk        | TS                         | Replaces PII with XML-like tags `<PII type="PERSON" id="1"/>`, adding attributes such as `gender="male"` and scope. Session-persistent IDs and an AES-256-GCM encrypted PII map for "rehydration". `existingPiiMap` continues numbering. Handles NER across streaming chunk boundaries. Local ONNX NER (~280 MB). Proxy mode for Claude Code.                                                         |
| flare-redact           | https://github.com/flare-collection/flare-redact | TS                         | Modes: `mask` (`b***@***`, default), `label` (`[REDACTED:email]`), `hash` (HMAC-SHA-256), keyed shape-preserving `pseudonym` (`kqz@rwmp.dnu`), and `surrogate` (`user_93a78c61e204@example.invalid`, Luhn-valid cards). Masks by key name, with a password vocabulary in 24 languages. Opt-in detectors: high entropy, crypto (BTC/ETH/BIP39 seed), VIN, `name [at] host [dot] tld`. Created 2026-07. |
| cloakrs                | https://github.com/kadir/cloakrs                 | Rust (+Python alpha)       | CLI for text, JSON, CSV and SQL dumps. `sanitize` / `restore` with `mapping.json`. SARIF audit output, pre-commit hook, `--exclude-entities`. README warns that excluding `url` leaks `https://alice:<password>@example.com/private` (password `supersecret` in the fixture)`.                                                                                                                        |
| pii-shield             | https://github.com/pii-shield/pii-shield         | Go                         | Kubernetes sidecar or log pipe. Context-aware entropy and key-name rules. Deterministic `[HIDDEN:a1b2c]` hashes. Preserves JSON structure. WASM build. `PII_SAFE_REGEX_LIST` allow list. Claims about 90k lines/s.                                                                                                                                                                                    |
| censgate/redact        | https://github.com/censgate/redact               | Rust                       | CLI, LLM gateway, Postgres scanner and WASM. `redact anonymize --strategy mask`, `-l es` language hint. Hash-chained evidence ledger with Rekor anchoring. 61 default secret types.                                                                                                                                                                                                                   |
| PasteGuard             | https://github.com/sgasser/pasteguard            | TS (Bun) + Python detector | Local proxy and browser extension for ChatGPT, Claude, Gemini, and coding agents. GLiNER + python-stdnum detector. Mask mode restores placeholders in responses, including streaming. Also detects secrets. 822 stars.                                                                                                                                                                                |
| packyme/privacy-filter | https://github.com/packyme/privacy-filter        | Go                         | Pure Go with no ML. Typed irreversible Chinese placeholders (`[邮箱]`, `[电话]`, `[身份证]`, `[银行卡]`, `[密钥]`). 222 gitleaks rules compiled under RE2 (no ReDoS). Spans are merged and de-overlapped, then the text is rebuilt in one pass. No name detection, by design.                                                                                                                         |
| MaskGate               | https://github.com/tsymbaluyk/maskgate           | (proprietary source)       | Landing-page repo only, not open source. Russian passport, INN, SNILS, OGRN, KPP and BIK. Anti-bypass normalization (homoglyphs, zero-width characters, base64).                                                                                                                                                                                                                                      |
| neosync                | https://github.com/nucleuscloud/neosync          | Go                         | Database anonymization and synthetic data (4.1k stars). Last push 2025-08, so possibly inactive.                                                                                                                                                                                                                                                                                                      |
| ankane/pdscan          | https://github.com/ankane/pdscan                 | Go                         | Scans data stores (Postgres, MySQL, S3, files) for unencrypted PII. Detection only.                                                                                                                                                                                                                                                                                                                   |

Other 2024-2025 entries seen but not researched further: HydroXai/pii-masker (DeBERTa, no license),
OpenPipe/pii-redaction (MIT, fine-tuned model, 2025-03), thyrisAI/safe-zone (Apache-2.0),
gregmos/PII-Shield (MCP + CLI).

---

## 13. Feature comparison matrix

Legend: Y = yes, P = partial or plugin, N = no, ? = unverified.

| Feature                         | Presidio                   | scrubadub          | DataFog                      | LLM Guard            | Philter/Phileas            | OpenRedaction         | redact-pii          | pino/@pinojs | Rehydra         | flare-redact                    | cloakrs          |
| ------------------------------- | -------------------------- | ------------------ | ---------------------------- | -------------------- | -------------------------- | --------------------- | ------------------- | ------------ | --------------- | ------------------------------- | ---------------- |
| Regex patterns                  | Y                          | Y                  | Y                            | Y                    | Y                          | Y (570+)              | Y                   | N            | Y               | Y                               | Y                |
| Checksum validation             | Y (many)                   | P (Luhn)           | P                            | Y (via Presidio)     | Y (Luhn, mod11/23/97, VIN) | Y                     | N                   | N            | ?               | Y (Luhn)                        | Y                |
| Context words / scoring         | Y                          | P                  | N                            | Y                    | Y                          | Y                     | P (greetings)       | N            | ?               | P                               | ?                |
| Confidence scores               | Y                          | N                  | P                            | Y (threshold)        | Y                          | Y                     | N                   | N            | ?               | N                               | ?                |
| ML NER                          | Y (spaCy/Stanza/HF/GLiNER) | P (spaCy/Stanford) | Y (spaCy/GLiNER)             | Y (BERT/DeBERTa)     | Y (Ph-Eye)                 | N (core)              | N (opt. Google DLP) | N            | Y (ONNX)        | N                               | N                |
| LLM-based detection             | Y (LangExtract)            | N                  | N                            | N                    | N                          | P (hosted tier)       | N                   | N            | N               | N                               | N                |
| Allow list                      | Y (exact/regex)            | N                  | Y (exact + full-match regex) | Y (allowed_names)    | Y (ignore lists)           | Y (whitelist)         | N                   | N            | ?               | Y                               | Y (exclude)      |
| Deny list / known values        | Y                          | Y (UserSupplied)   | N                            | Y (hidden_names)     | Y (dictionaries)           | Y (custom)            | Y (custom regex)    | Y (paths)    | ?               | ?                               | ?                |
| False-positive heuristics       | P                          | N                  | Y (negative corpus)          | N                    | P                          | Y (dedicated filter)  | N                   | n/a          | ?               | ?                               | ?                |
| Key-name (structured) redaction | P (presidio-structured)    | N                  | N                            | N                    | N                          | P                     | N                   | Y            | N               | Y                               | Y (JSON/CSV)     |
| replace (type label)            | Y                          | Y                  | Y                            | Y                    | Y                          | Y                     | Y                   | Y            | Y               | Y                               | Y                |
| mask (partial)                  | Y                          | N                  | N                            | P (secrets partial)  | Y (MASK, LAST_4)           | Y (mask-middle)       | N                   | N            | N               | Y                               | Y                |
| hash                            | Y (salted)                 | Y (salted)         | Y                            | Y (secrets)          | Y                          | ?                     | N                   | N            | N               | Y (HMAC)                        | ?                |
| encrypt (reversible)            | Y (AES)                    | N                  | N                            | N                    | Y (AES, FPE)               | N                     | N                   | N            | Y (AES-GCM map) | N                               | N                |
| fake / surrogate values         | P (custom op, AHDS)        | N                  | N                            | Y (Faker)            | Y (random replace)         | Y (token-replace)     | N                   | N            | N               | Y (surrogate)                   | ?                |
| Format-preserving output        | N                          | N                  | N                            | N                    | Y (FPE)                    | Y                     | N                   | N            | N               | Y (pseudonym)                   | ?                |
| Consistent numbered tokens      | P (custom op)              | Y (incremental)    | Y (`[EMAIL_1]`)              | Y (`[REDACTED_X_n]`) | Y (context)                | Y                     | N                   | N            | Y (session)     | Y (keyed)                       | Y                |
| Reverse / restore               | Y (decrypt, deanonymize)   | N                  | N                            | Y (Vault, fuzzy)     | Y (decrypt)                | Y (redactionMap)      | N                   | N            | Y               | P (keyed)                       | Y (mapping.json) |
| Date shifting                   | N                          | N                  | N                            | N                    | Y                          | N                     | N                   | N            | N               | N                               | N                |
| Images / PDF / DICOM            | Y (image, DICOM)           | N                  | deprecated (OCR)             | N                    | Y (PDF)                    | ?                     | N                   | N            | N               | N                               | N                |
| Streaming                       | N                          | N                  | N                            | N                    | N                          | ?                     | N                   | per log line | Y (chunk-aware) | ?                               | ?                |
| CLI                             | N (library + REST)         | N                  | Y                            | N                    | P (philter-cli ?)          | ?                     | N                   | N            | ?               | ?                               | Y                |
| Server / API                    | Y (Docker REST)            | N                  | N                            | Y (llm-guard-api)    | Y                          | P (middleware)        | N                   | N            | Y (proxy)       | N                               | N                |
| Offline                         | Y                          | Y                  | Y                            | Y                    | Y                          | Y (core)              | Y (without DLP)     | Y            | Y               | Y                               | Y                |
| Languages                       | many (per recognizer)      | en + locales       | en (+de opt-in)              | en, zh               | en                         | multi-region patterns | en                  | n/a          | multi (NER)     | 24-language password vocabulary | ?                |
| JS/TS native                    | N                          | N                  | N                            | N                    | N                          | Y                     | Y                   | Y            | Y               | Y                               | N                |

Sources: sections 2-12 above.

---

## 14. Hard or unusual competitor features worth considering

1. Checksum-heavy national IDs with negatives. Presidio and OpenRedaction pair every positive with
   a near-miss negative (Luhn +1, mod-97 +1, forbidden NINO prefixes, invalid SSN groups, Aadhaar Verhoeff,
   PESEL, KR RRN date validation, CA SIN Luhn, AU ABN mod-89, VIN check digit). Importing these pairs is the
   cheapest way to measure precision.
2. Context-gated identifiers. OpenRedaction redacts Discord IDs, Steam IDs, Emirates IDs and Saudi IDs
   only with a context keyword; the same digits without context are negatives. Presidio applies the same
   idea through context-word score boosts, including non-English words ("NAS", Thai).
3. A dedicated false-positive filter for versions, measurements, ports, prices, years, sequential and
   repeated digits, and "test/example" keywords (OpenRedaction). DataFog's negative corpus covers ISBNs,
   part numbers, hex build IDs, version tags, regex literals and code identifiers.
4. Idempotence on already-redacted text: `[EMAIL_1]`, `<REDACTED>` and block masks must not be
   re-redacted (DataFog edge corpus).
5. Adjacent PII with no separator (`john@acme.com123-45-6789`) and overlap resolution
   (`2020-01-01.1` gives a DATE, not an IP) (DataFog).
6. Unicode normalization with offset mapping back to the original text (Presidio). MaskGate (closed
   source) advertises homoglyph, zero-width and base64 de-obfuscation.
7. Obfuscated emails: `john at gmail.com` (scrubadub), `john.doe[AT]protectai[DOT]com` (LLM Guard),
   `name [at] host [dot] tld` (flare-redact).
8. Reversible pipelines for LLM round-trips:
   - LLM Guard: Vault plus fuzzy deanonymize.
   - Rehydra: encrypted PII map, session IDs, and gender/scope attributes on tags.
   - PasteGuard: restores placeholders inside streaming responses.
   - OpenRedaction: redactionMap.
   - cloakrs: mapping.json.
   - Presidio: AES decrypt.
9. Many output operators:
   - mask-middle (`555-***-4567`, `S***h J***s`)
   - format-preserving (`XXX-XX-XXXX`, `(XXX) XXX-XXXX`)
   - FPE encryption (Phileas)
   - keyed shape-preserving pseudonyms and Luhn-valid surrogates (flare-redact)
   - salted short hashes (`PHONE-DB92D`, scrubadub)
   - date shifting and relative dates (Phileas)
10. Conditional policies such as "redact ZIP only if population < N" and "ages > N" (Phileas). The
    policy-as-data and PhiSQL approach is unusual.
11. Path-based structured log redaction with wildcards, `remove`, censor functions and non-mutating
    cloning (pino/@pinojs/redact). flare-redact and pii-shield combine this with content scanning.
12. Streaming chunk-boundary handling (Rehydra, PasteGuard) and claimed high throughput (pii-shield,
    about 90k lines/s; packyme RE2 linear-time regexes with no ReDoS).
13. Compliance presets (`gdpr`, `hipaa`, `pci-dss`, ... in OpenRedaction) and risk scoring mapped to
    HIPAA/NIST categories (pii-codex).
14. Small permissive in-browser ML: openai/privacy-filter (Apache-2.0, transformers.js, 128k context).
    This is the first strong permissively licensed PII model that runs in JS.
15. Allow-list regexes that must match the whole span (DataFog `allowlist_patterns`), which avoids partial
    suppression bugs.

Contradictions between tools that a test suite must choose a side on:

- UUIDs: Presidio treats them as PII (UUID recognizer); DataFog treats them as a negative.
- Space-separated SSN `123 45 6789`: Presidio and redact-pii match it; DataFog regex does not.
- `123-45-6789`: Presidio treats it as an invalid sample; OpenRedaction and redact-pii treat it as a
  valid SSN.
- Generic dates: Presidio reports DATE_TIME; OpenRedaction suppresses them without DOB context; LLM
  Guard's resume test leaves a DOB unredacted.
- Bitcoin addresses: Presidio validates the checksum; Phileas matches a malformed address.

---

## 15. Unverified items and caveats

- Presidio: the exact filename of the text-normalizer tests and the full recognizer count (about 140,
  estimated from the directory listing).
- Philter/Phileas:
  - the SSN-vs-phone vector disambiguation
  - `philter-cli` status
  - the ZIP-population condition
- OpenRedaction:
  - the "570+ patterns" count
  - streaming and Express middleware
  - whether hash mode exists
- DataFog: the Rust backend performance and the details of the Claude Code / LiteLLM integrations
  (README only).
- New projects (Rehydra, flare-redact, cloakrs, pii-shield, censgate/redact, PasteGuard, packyme): features
  come from READMEs only. Throughput figures are self-reported.
- MaskGate: the source is not public, so it is not open source despite the GitHub repo.
- scrubadub license: the GitHub LICENSE says Apache-2.0 while the PyPI metadata says MIT.
- fast-redact: deprecation status not confirmed. pino 10.x uses @pinojs/redact, and pino's docs still
  mention fast-redact.
- Star counts drift. All figures are as of 2026-11-10.
- Some JSON inputs are fragments of longer upstream test strings (for example the LLM Guard resume
  test). Where that happened, the `notes` field says so. The sensitive substrings are exact.
