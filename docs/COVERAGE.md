# Detection coverage and limits

Coverage is a union of maintained detectors, explicit known values, context and conservative native rules. Detection is heuristic; there is no claim of perfect recall, universal anonymity, or superiority over every competitor.

## Credential coverage

The native provider supplements in `src/rules.js` cover GitHub, GitLab, OpenAI, Anthropic, AWS access IDs, Google API/OAuth, Slack, Stripe, SendGrid, Twilio, npm, PyPI, Telegram, Discord, Hugging Face, Shopify, Databricks, Square, Mailchimp, DigitalOcean, Vault, Grafana, Linear, Notion, Vercel, and JWT-shaped values. Prefix matches also protect selected truncated tokens; they do not validate a token with a provider.

The default native engine bundles 221 text rules from Gitleaks 8.30.1 (222 upstream rules; the path-only PKCS12 rule is outside text detection), compiled unchanged with RE2/WASM or RE2JS for inputs above 4 MiB. Dense rule matches switch to RE2JS after at most eight WASM matches per view, bounding repeated whole-input copies without truncating secrets or changing anchors. The MIT license, commit and sync script are retained in `src/vendor/gitleaks`. Keyword prefilters and configured entropy thresholds run natively; upstream comment/path allowlists cannot suppress a sanitizer finding. Quoted hex/base64 entropy detection supplements those rules. The default asynchronous engine additionally uses the pinned Secretlint recommended scanners, excluding its comment-filter rule. Embedded disable directives in untrusted text cannot suppress findings. Optional Gitleaks and TruffleHog invoke their installed detector sets, and custom detectors can add formats. Service counts are not a measure of comparative recall.

Context rules recognize credential labels with bounded key affixes, JSON and nested escaped JSON, YAML/env/INI assignments, shell flags, XML values, URL userinfo, authorization headers, cookies, webhook paths, and complete or truncated private-key PEM blocks. Low-entropy contextual values such as `password=1234` are protected. Generic token counters, booleans/null/language literals and ordinary Git hashes are excluded to retain useful logs. Supply literal known values for ambiguous credentials or unusual key names.

Broader unquoted entropy scanning is opt-in (`paranoid: true`), uses Shannon entropy ≥4.2 on bounded candidates, and exempts ordinary hex hashes and common tool identifiers. Quoted hex/base64 and entropy checks belonging to bundled provider rules run by default. Entropy has both false positives and false negatives; contextual detection and known-secret dictionaries remain necessary.

## Personal data and languages

### Document entities

`profile: 'documents'` (or `documentEntities: true`) opts into the following
additional rules. They are off under the existing default and publication
profiles, preserving credential/log fixture behavior and avoiding extra company
name redactions in stack traces. Existing contextual organization detection
remains available under those profiles.

| Type           | Coverage                                                                                                                              | Confidence |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `ORGANIZATION` | Proper names next to legal forms in either order, optionally quoted: Inc, LLC, Ltd, GmbH, AG, S.A., ООО, АО, ПАО, ИП and locale forms | 0.70       |
| `EDUCATION`    | Proper names next to University, College, Institute, school and locale equivalents, in either order                                   | 0.65       |
| `LOCATION`     | Exact city/region entries from a bounded offline vocabulary                                                                           | 0.60       |
| `LOCATION`     | Bounded proper names after location labels, including based in, located in, relocated from, г., город and locale equivalents          | 0.75       |

Russian document rules also accept legal-form quoted names with lowercase words,
digits and hyphens (up to 160 characters), organization Group/Групп/Holding/Холдинг
markers, adjectival institution names with lowercase connectors and optional
`имени` tails, education acronyms in context, residence labels and city/country
phrasing. A known given name after `Меня зовут` or `С уважением` scores 0.70.
Detected organization cores propagate within a document and across confirmed
stream records. Russian regional cities include Ярославль and Кострома; the
vocabulary remains finite. Default profiles do not enable these document rules.

These confidence values indicate heuristic strength, not calibrated
probabilities. `minConfidence` still controls replacement. Findings retain
their confidence even below threshold. `publicEntities` supports exact reviewed
exceptions for all three types; `knownPersonal` always forces removal of a
listed private value. All types support placeholder mode; fake mode uses stable,
plausible organization/school/location names from an authored vocabulary or
caller-supplied `pools`, declined to match Russian source mentions. These names
are plausible and can coincide with real entities that the text does not mention.

`src/document-vocabulary.js` is the complete authored vocabulary: English,
Spanish, French, German, Portuguese, Russian, Japanese, Simplified/Traditional
Chinese, Korean, Arabic, Hebrew, Hindi, Turkish, Indonesian, Vietnamese and
Thai each have list-form employer, school and city fixtures. Proper-name
rules are finite (up to six capitalized words, or four words in scripts without
case); they do not implement grammatical parsing. Other lowercase connectors,
unusual typography, unsupported legal forms and unfamiliar institutions can be
missed. Legal-form words and uncased scripts can also yield false positives.

The `documents` profile also reads employers from CV experience lines anchored on
a date range: `Title, Employer (2019-05 – 2021-03)`, `Title — Employer, 2019–2021`
and `Title (Employer), 2019–2021`. Ranges use years, `YYYY-MM`, `MM.YYYY`, full
dates or `month YYYY`, with `по настоящее время`, `н.в.`, `по н.в.`, `present` and
similar open ends. For the non-parenthesized layouts, titles have one to nine words. A label of one or two words
before the title (`Опыт: `, `Опыт работы - `, `Опыт — `) is read like a list marker,
and a segment after `|` is read like a line start, so
`Должность: Менеджер | Опыт: Аналитик, Ромашка (2018 – 2020)` also yields the
employer. The date range stays the anchor and the employer must still start with a
capital letter, a digit or a quote. Confidence is 0.60, and the employer then
propagates through the document like other organizations. The default profile
ignores these lines. Lines
with parenthesized ranges additionally support arbitrary title prefixes,
comma-containing employers and titles, as described below. Date-anchored prose
with the same shape can be flagged.

The gazetteer has only the cities/regions explicitly listed in that module,
including Springfield and Riverton. It is not a worldwide geocoder. Location
labels can find unlisted proper names; unlabelled places outside the vocabulary
need `knownPersonal` or an additional detector such as the Presidio bridge.
Name linking is also heuristic, especially for shared surnames, transliterations
and inflected forms. Employers, schools, locations, dates and other
quasi-identifiers can re-identify a person when detection misses them. Neither
placeholder mode nor no-map mode promises universal anonymity. A restore map
contains personal data and must remain private; see [API.md](API.md#reversible-placeholders).

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
| Input                 | 32 MiB CLI bytes / 32 Mi UTF-16 library units by default; configurable                                |
| Normalized projection | At most 18 times input length for Unicode normalization expansion; input limits apply                 |
| Encoded candidates    | 8,192 raw characters per decoded run; audited redaction for longer runs; 4,096 candidates, two layers |
| Directory             | 10,000 files; `.git` and `node_modules` omitted                                                       |
| Findings              | 100,000 hits; exceeding the limit blocks analysis                                                     |
| Local subprocess      | Default 30 seconds and 10 MiB report/stdout cap; failures block output                                |
| Git objects           | 10,000 objects, 10 MiB per object and 100 MiB total by default                                        |

Supported decoding includes canonical base64/base64url, line-wrapped base64, hex, percent, HTML entities, UTF-8 byte escapes and JSON string escapes, with fatal UTF-8 checks for decoded payloads. Plain log files and streams preserve invalid UTF-8 bytes reversibly while scanning surrounding valid text; structured JSON/JSONL and configuration remain strict. Opt-in encoding preservation round-trips sanitized payloads; nested escaped JSON retains its structure by default. Arbitrarily split fragments, unlimited nesting, compressed/encrypted payloads, malformed encodings, archives, PDFs and OCR/images are outside this text profile. Whole-input/candidate limits fail; oversized textual percent/base64 runs receive audited complete-run redaction. Unsupported representations may remain undetected. `decode: false` intentionally reduces coverage. A caller needing another format should decode it through a bounded preprocessing adapter and retain correct original spans.

Default text mode can replace JSON numeric values with string markers and change syntax/types. Opt-in structured JSON/JSONL mode scans string keys/values separately, preserves primitive types, and rejects malformed output or key collisions. Numeric personal values need a separate caller schema policy. Existing quoted JSON strings and escaped-string fixtures retain their delimiters. Review sanitized artifacts for their intended consumer.

An unchanged result is not proof that text contains no sensitive information. The original sensitive input, private config, scanner reports, temporary files during execution, backups, screenshots, and remote caches remain separate handling concerns. POSIX permissions do not create equivalent Windows ACL guarantees or secure memory/disk erasure. In-place replacement creates a new file; it does not preserve ownership metadata, ACLs, or guarantee crash durability of the directory entry.

## Entity catalogs and optional modes

Documented Google/Azure/AWS catalog names (214/180/36) are recognized as explicit native labels, including canonical underscore and original camel-case forms. Generic DATE is excluded so ordinary headers/calendar dates remain intact; personal birth-date context still qualifies. This vocabulary is distinct from automatic vendor NLP/image/cloud-service features. Typed transformations and confidence are described in [API.md](API.md); full redaction remains the default. Public Wikidata names, known role/domain emails and public resolver/documentation IPs use explicit offline knowledge and heuristics. Opt-in network lookup does not establish identity; private overrides and credential priority remain authoritative.

Large text logs use bounded record streaming and worker file publication. Plain-text records inherit the configurable total limit (1 GiB by default), so memory grows with the largest held record. The whole-string default is 32 Mi UTF-16 units. `credentialsOnly: true` preserves personal/account details across all finding sources while retaining credential detection and verification. The review corpus benchmark is a finite, synthetic regression comparison; [method, settings and results](../experiments/benchmark/README.md) explain its scope. It does not demonstrate general market-wide superiority.

Structured JSONL streaming supports 8 MiB records and ordered record workers;
[issue 24 evidence](case-studies/issue-24/README.md) records the 7 MiB regression
and reproducible throughput measurement. Realistic fake mode preserves supported
scripts/formats/checksums and uses reserved contact ranges where available.
Generated identities are pseudonyms; valid arithmetic does not prove non-issuance.

## Document forms reviewed in issues 77–83

Structured JSON/JSONL scans each decoded string at its own line start as well as
with its field label. This includes array elements, multiline strings and up to
two embedded JSON container layers. Both the synchronous API and asynchronous
engine union use these views. Source offsets include original JSON escapes;
unchanged values and whitespace remain byte-identical. Numeric primitives still
require a caller schema policy. `debug` can observe `structured-value` events
with finding counts, without logging the string contents.

The `documents` profile additionally recognizes:

- Russian mobile numbers with dashed, dotted, spaced or parenthesized forms,
  including ten-digit `9xx` forms and domestic `8` prefixes; `тел.`, `моб.` and
  WhatsApp labels; `wa.me` contact links.
- Obfuscated email separators `(at)`, `[at]`, `собака`, and English `dot`/`at`,
  including `[dot]`, `(dot)`, `(точка)` and `[точка]` with optional spaces.
  Complete addresses remain protected alongside capitalized proper-name matches.
  This is a finite spelling grammar, not arbitrary email deobfuscation.
- Personal paths on LinkedIn (`/in/`), GitHub, VK, Instagram and Telegram,
  including scheme-less links; Telegram/телеграм/tg/skype/ник labels without `@`.
  A provider root such as `https://github.com/` remains unchanged. These rules
  cannot distinguish a person from an organization account on the same service.
- Russian passport series/number phrases, ОГРНИП, subdivision codes, dated
  ОВД/УВД/МВД issuer phrases, Russian/English driving licence labels, ОМС/полис,
  Russian account numbers and numbered diplomas. These contextual patterns do
  not validate issuance; digits are protected even with invalid checksums.
- Numbered schools, gymnasiums, lyceums and colleges; school acronyms after
  Образование/ВУЗ/Университет/окончил/окончила, with optional `им. Баумана`-style
  suffixes. Acronym detection is contextual rather than a complete school list.
- Surname/initial shapes in Cyrillic and selected Latin Slavic forms, known
  given-name plus initial, Russian surname/given-name pairs using finite case
  forms and lower case, and surnames after г-жа/господин/госпожа.
- Birth years with д.р./г.р./год рождения/родился/родилась/Born in context;
  Russian age expressions and Пол labels, English Sex, and gender beside age.
  Bare age-in-years expressions are ambiguous and remain unchanged without
  affirmative personal-age context; durations are preserved.
- Labelled citizenship, marital status, children, nationality, religion,
  disability and criminal record, including the reported English labels.
- Company/employer/workplace labels, capitalized company/holding/bank names,
  employment prose and year-range employer lines; residence/metro/district
  labels and contextual six-digit postal codes.
- Russian street-plus-house/flat structures, including inline addresses added
  by #117. `Музей находится на ул. Ленина, д. 5, кв. 12` now removes the full
  street/house/apartment span. Public addresses have the same shape as personal
  addresses and may be flagged; inspect them before publication.

Explicit limits accepted for the ambiguous examples in #82/#83:
`Спасибо, Анна!`, `Анна, добрый день!` and `Менеджер Анна`
remain unchanged without known values or additional context. Bare given names
and unmarked employer/title fragments cannot reliably establish identity.
The reversed employer cue `Лютик, менеджер` now redacts `Лютик`, as requested
by #117. English `Worked at Romashka` now redacts the employer under #115.
`зарплата 150 000 руб.` and `Salary: 150000` also remain unchanged: salary is
outside the native document rules. Supply `knownPersonal` or an additional
recognizer when these fields must be removed. Initial/name rules do not cover
all surnames, languages, cases or arbitrary lower-case names.

Operational value policy (#79): a single-slash relative URL with no query,
fragment, userinfo or explicit u/in/user/profile/member/home/people path stays unchanged
under `url`; other detectors and known values still apply. An ISO-style
`YYYY-MM-DDTHH:mm:ss[.fraction](Z|±HH:mm)` timestamp under `time` stays unchanged.
This exemption is syntactic, not date validation. Userinfo, token-bearing URLs
and personal paths still redact. Context-free 40-character hexadecimal values
are treated as SHA-1-shaped identifiers in both text and structured modes,
including quoted values. This does not prove they are harmless: actual bare
40-hex secrets require `knownSecrets` or credential context. Credential labels,
provider-specific rules and required external scanners remain authoritative.

The [complete requirement inventory and alternatives](case-studies/issue-84/README.md)
links every reported text row to its regression case.

## Document context refinements (issues 87–88)

Age requires a label (`возраст 41`, `Age 41`), personal pronoun (`мне 29 лет`),
birthday verb (`исполнилось 34`) or gender followed by age (`Женщина, 34 года`).
Bare `34 года` remains unchanged as an ambiguous limit. Work experience, tenure,
contract lengths and elapsed/future durations stay unchanged. `Дети: нет` and
`Гражданство: не указано` are treated as empty fields; negative disability and
criminal-record statements remain sensitive attributes.

Additional document forms include `контактный телефон` and `сот.` phone labels,
parenthesized `(собака)` email separators, `телега`/`Zoom` messenger labels,
dated `ТП УФМС`/`УФМС` passport issuers, `р/с` account numbers, `г-н` surname
titles, `1985 года рождения` and `г.р. 1985`, abbreviated/single-letter gender
values (`Пол: Ж`, `Пол: М`, `пол: жен.`, `пол муж.`), `гражданин РФ`,
`есть двое детей`, `проживаю в Перми`, and English `Employer`, `Company` and
`Education` labels. A capitalized Cyrillic word followed by two initials is
recognized regardless of surname ending (`Цой В. Р.`, `Ким Д. С.`,
`Шевченко Т. Г.`). This structural rule can flag non-name text with the same
shape; it does not provide a complete surname dictionary.

JSON escape boundaries cannot start an obfuscated-email local part, preserving
stack newlines and frames after IP:port. Relative `/u/<name>` and `/in/<name>`
URLs are personal paths under `url`, like the existing user/profile paths.
Exact `0.0.0.0` is an operational unspecified bind address, like loopback/local
addresses. `publicKnowledge: false` and explicit private known values still
redact it.

## Structured JSON cost (issue 86)

Structured sanitization scans labelled raw strings and each decoded string with
its own line boundaries, then verifies sanitized output. This preserves detection
in arrays, CV fragments and embedded JSON, but adds fixed work per string/key.
Costs depend on string count, enabled engines, content, runtime and hardware;
line length alone cannot predict synchronous main-thread delay.

A finite serial measurement on Linux x64, Node 26.13.0, using the documents
profile and structured JSON, produced these median milliseconds per `sanitize`
call (100 warm-ups, three 100-call trials):

| Fixture                                   | 0.16.0 | 0.16.1 | This change |
| ----------------------------------------- | -----: | -----: | ----------: |
| Short JSON (89 characters)                |   1.21 |   8.44 |        4.67 |
| Exact issue reproduction (264 characters) |   1.81 |  19.71 |       11.15 |
| Longer synthetic JSON (9,396 characters)  |  10.04 |  37.88 |       28.32 |

The short and longer synthetic rows approximate the issue's unpublished
100/9,453-character inputs; only the 264-character input was provided in full.
These results are evidence for this container, not a universal latency guarantee
or an Apple Silicon comparison. The issue reporter measured 0.16.1 at
2.31/5.61/34.85 ms on their short/264-character/9 KiB rows and 1.10 ms for the
264-character text-mode control. The remaining structured overhead is **above
2x** of 0.16.0 here; documenting that cost fulfills the issue's alternative
acceptance criterion. No detection view is removed to meet a timing target.

Personal-label patterns are now constructed once instead of for every scan, and
redundant explicit RegExp cloning is avoided when `matchAll` supplies isolation.
Reproduce with `node --max-old-space-size=256 experiments/issue-89/benchmark.mjs`
and optionally pass a released checkout's `src/index.js`. For latency-sensitive
logging, measure the real workload before synchronously sanitizing every line;
the existing JSONL record-worker API/CLI can move record scanning off the main
thread (see [API.md](API.md)). External engines and more sensitive values can add
further work. These numbers do not describe `createSanitizer` with Secretlint.

The [complete issue 89 requirement inventory](case-studies/issue-89/README.md)
records every row, root cause, alternative and regression mapping.

## Document URL and field refinements (issues 91 and 94)

The document profile detects `email=` and `phone=` query values in absolute and
relative URLs and access-log text, retaining the label while percent-decoding.
It replaces the same complete value for plain and percent-encoded contacts,
without reserializing unaffected URL bytes. Invalid percent escapes do not
qualify through this decoding rule. Personal `/u/`, `/in/`, `/user(s)/`,
`/profile(s)/`, `/people/`, `/member(s)/` and `/home/` paths apply independently
of the containing field label. These paths can also describe public accounts;
the rule cannot establish identity or access permissions.

An absolute HTTP(S) URL with a 24–128-character ASCII alphanumeric/underscore/
hyphen path segment is treated as a possible share link and replaced, including
Google Drive/Docs and generic `/s/<opaque-id>` links. This is a conservative
shape rule, not a check of sharing permissions or entropy; public URLs with
long segments may also match. Ordinary documentation paths and provider roots
remain unchanged. Personal site roots such as
`портфолио https://ivan-petrov.example.org/` remain a documented limit: a root
alone cannot establish that the site belongs to a person.

Structured document field aliases remove `_`/`-` and ignore case before matching
this explicit vocabulary: `firstName`, `lastName`, `middleName`, `patronymic`,
`candidateName`, `displayName`, `fullName`, `originalFileName`,
`age`, `birthYear`, `birthday`, `birthDate`, `sex`, `citizenship`, `nationality`, `company`,
`companyName`, `employer`, `university`, `school`, `contact`, `resumeUrl`,
`alternateUrl`, `profileUrl`, `companyUrl`. Their nonempty string values are
sensitive in full, including ISO birth timestamps. Thus `first_name` and
`firstName`, or `birth_date` and `birthDate`, follow the same policy. These are
schema assumptions: `contact` or `company` can hold operational data too.
Person fields also match as a word-boundary suffix of a compound key, so
`recruiterDisplayName`, `author_full_name` and `resumePdfOriginalFileName` are
person fields. The same suffix rule applies to `vocabulary.personalFields`.
Other types match only the whole key (`maxAge` and `fileName` stay), and a
bare `name` is not in the list.
Existing native labels still apply. Unlisted URL-named fields have ordinary
content detection; arbitrary names do not imply sensitivity. Declare them with
[`sensitiveFields`](API.md#caller-declared-sensitive-fields) to replace complete
values, including non-string values. Numeric `age` and `birthYear` values are replaced by the JSON string
`"[REDACTED]"`; unrelated numeric primitives retain their types. Bare `name`,
`jobName` and `productName` remain ambiguous and use content detection.

Employer labels consume multi-word values to a comma or line/quote boundary.
Dated CV entries additionally support compound titles, title parentheses/slashes,
quoted group names, legal-form/location suffixes, empty/`null` range ends,
multiple entries, employer-first role entries and pipe-separated entries.
The parenthesized date-anchor scanner accepts arbitrary forward titles and
lead-ins. The reversed `Company, manager` layout retains finite role cues. Undated
`Менеджер, Ромашка Лютик`, `- Ромашка Лютик 5 лет` and
`Последнее место работы Ромашка Лютик` remain explicit ambiguous limits, as
permitted by #94. Use known values or schema declarations for them.

Company prose recognizes `компании «…»`, `опыт в`, `Роль в`, `проекты для`,
capitalized lists after those cues, `опыт (Company Name)`, and names followed
by `(2 года)`/`(3 года)`-style durations. Arbitrary uncued company words remain
ambiguous; synchronous callers can supply `knownPersonal` lists or precomputed
`findings`. Array-returning custom `detectors` also run in synchronous methods; Promise-returning callbacks require `createSanitizer`. No model or network service is required for these native rules.

`контакт:` and `пишите,` introduce domestic mobile numbers. A complete line
consisting of an 11-digit `79…` or `89…` mobile shape is also sensitive. Arbitrary
prose numbers such as `order 89161234567 shipped` and `id 79161234567` remain
unchanged. This shape rule does not prove that a number is assigned.

Additional forms cover Cyrillic acronyms after `Education:`, `учился в`,
`Соискатель:`/`Сотрудник:` names and split-line `С уважением,` signatures.
`Дети: нет` remains an empty attribute with later JSON string lines preserved.
When mapped escaped fragments lose detecting context on recursive decoding,
redaction replaces the fragment instead of repeating an unchanged result until
`ERR_RESIDUAL`; the surrounding JSON remains parseable.

The [requirement inventory and research](case-studies/issue-100/README.md)
records the complete scope and regression evidence.

## Dated entries and optional prose (issues 104–106)

Parenthesized date anchors now delimit successive entries on the same line,
including arbitrary title words and lead-ins (`Стаж = 5 лет:`, `= 3 года,`).
Employers can contain comma suffixes, nested parentheses, slash-separated names,
legal forms and multiple words. A pipe after the employer preserves the industry
suffix. `Founder, consultant, Romashka (2019–2021)` and equivalent Russian entries
share the parser. The employer must start with a capital letter, a quote, or a
company-style digit/letter combination. **Lowercase employers remain a limit**:
`Менеджер, romashka (2019–2021)` / `Менеджер, ромашка (2019–2021)` stay, preserving
ambiguous controls such as `Встреча, понедельник (2019–2021)`.

`ГК` and `группа компаний` introduce quoted or unquoted group names. Employment
lists continue through repeated `, потом в` and `, затем в` items. Domestic
`79…`/`89…` mobile shapes after a comma work in Russian and English text; plain
`order`/`id` numbers stay. School detection also covers `(МГУ, 2012)`,
`Образование (МГУ)`, `в МГТУ им. Баумана` and `Обучение: Skillbox, 2020`.
The acronym vocabulary remains finite.

Weak organization experience/duration cues preserve a small explicit technology
set: Python, Go, SQL, Excel, Power BI, Kubernetes, PostgreSQL, Telegram and Scrum.
This is an ambiguity policy, not general recognition of every product; a real
employer with one of those names needs `knownPersonal` or a declared sensitive
field. Explicit private values/fields and stronger legal-form cues still win.

Document share-link detection also recognizes HTTP(S) URLs containing `/d/<id>`
for any host and nonempty id length. Ordinary website roots remain a limit.
Relative operational paths such as `{"location":"apps/api"}` stay; explicit
personal paths and credential rules remain active. Caller-sensitive field names
now use the same case/underscore/hyphen normalization as built-in document names.

For no-cue prose, enable [`properNames: 'capitalized'`](API.md#structural-prose-redaction).
It activates per value, defaults to Cyrillic script letters or structural data
triggers, and supports configurable Unicode scripts. It intentionally loses
capitalized ordinary words. Known Cyrillic labels, non-Cyrillic labels, lowercase
words, dates, paths, JSON keys and untriggered values are outside this additional
rule. Unknown capitalized Cyrillic words before colons are protected. English
untriggered prose and lowercase names without context remain documented limits;
an explicit `работал в` / `работала в` cue also protects lowercase employers.
The API describes the interaction with existing detectors and placeholder modes.

The date-anchor scan visits each preceding entry once; the optional prose scanner
classifies maximal tokens in fixed passes, avoiding repeated suffix searches on
long unspaced input. This is not a latency guarantee for the whole pipeline.
[The requirement inventory](case-studies/issue-106/README.md) records alternatives,
research, regression evidence and reproducible bounded performance measurements.

## Stored-log policy and expanded document catalog

The documents profile now covers the exact positive/control rows of issues
115 and 117: spaced/obfuscated contacts, Discord/MAX handles, additional
personal-link routes, birthday/age cues, military/VIN identifiers, employer and
school layouts, patronymics/initials/mixed scripts, complete street/house spans,
regions, citizenship and plates. Regression tests compare complete text output
and JSON/JSONL output in both engines. `ОГРНИП` without a value, operational logs,
work durations, weekdays and technologies remain unchanged. Bare `Сергей`,
`Смирнова`, `Смирновой`, `СПб`, `Питер` and `Вчера Анна написала` deliberately remain
ambiguous without explicit known values, the optional recognizer or aggressive
proper-name mode. Romashka Inc keeps its existing legal-form treatment.

`strict: true` independently opts into personal attributes (gender, family,
ethnicity, religion, health, criminal/political status) and bare dates, ages,
passport/mobile/postal shapes. It is intended for stored personal prose and can
remove ordinary uses of unambiguous category words. Bounded Russian case/stem
rules cover disability, ethnicity, religion, diagnoses, intimate life and criminal
status, including `инвалидом`, `армянин`, `еврейка`, `казах`, `христианин`, `иудей`,
`эпилепсией`, `астма`, `онкологию`, `туберкулез`, `психиатра`, `депрессия`,
`гепатит`, `гей` and `отбывал наказание`. English coverage includes `epilepsy`,
`gay` and `Armenian`. Explicit category cues such as `по национальности X`,
`исповедует X`, `болеет X`, `на учете у X`, `diagnosed with X` and `ethnicity: X`
protect one following word (including hyphenated words) up to 64 characters,
including unfamiliar values outside the lexicon. These cues stay on one line.
Ambiguous English `disabled`, `single`, `man`, `men`, `russian`
and `asian` require an adjacent personal cue (pronoun/person role, personal
label, or following person role). Thus `he is disabled`, `candidate is single`
and `gender: male` redact, while `the module is disabled`, `single run finished`,
`single-flight lock acquired`, `man page missing`, `locale russian selected`
and `asian region endpoint` remain intact. Bare operational JSON statuses
`disabled`, `single` and `Russian` also remain intact; explicit personal labels
and caller-declared known personal values still redact. A cue in another clause
or string value does not make an ambiguous word personal.
It preserves ISO timestamps, work durations
(including `Стаж: 5 лет`, `работал там 5 лет`, and duration cues from issue 87),
and parenthesized durations after known technologies such as `Kubernetes (5 лет)`
and `Power BI (5 лет)`.
Explicit ages (`кандидату 34 года`, `мне 34 года`, `возраст 41`) and bare strict
ages remain sensitive. Work and skill duration context is retained through
redaction, placeholders and generated fake values for stable verification.
It also preserves
unit-bearing request timings and `Дети: нет`. In JSON/JSONL, numeric primitives
stay numeric, and `structuralFields` suppresses strict findings in declared
string metadata. Credentials/known values still take priority. Strict is off by
default and does not claim to identify every sensitive attribute or validate
that every date/number belongs to a real person.

## Optional offline recognition measurements

The `/ner` entry uses the separately installed optional
[NLP.js](https://github.com/axa-group/nlp.js) regex extractor, finite multilingual
name/place dictionaries and bounded contextual rules. It has synchronous
inference after `await createNerDetector(...)`. There is no analysis-time network,
external service, Python process or model download. The core import graph never
imports `/ner` or NLP.js, so the optional component has no runtime or loading cost
when disabled. This is symbolic recognition, not general statistical NER; unknown
cue-free surnames, schools, employers and locations can be missed.

[Test set](../experiments/issue-118/ner-corpus.json): 32 synthetic sentences,
including all six requested positives, eight benign controls and eight challenge
misses. Exact type and UTF-16 start/end must all match. **All** rows, including
challenge rows, contribute to these scores. Each language/type has two true
positives, zero false positives and one false negative:

| Language | Type         | Precision | Recall | TP / FP / FN |
| -------- | ------------ | --------- | ------ | ------------ |
| ru       | PERSON       | 100%      | 66.7%  | 2 / 0 / 1    |
| ru       | ORGANIZATION | 100%      | 66.7%  | 2 / 0 / 1    |
| ru       | EDUCATION    | 100%      | 66.7%  | 2 / 0 / 1    |
| ru       | LOCATION     | 100%      | 66.7%  | 2 / 0 / 1    |
| en       | PERSON       | 100%      | 66.7%  | 2 / 0 / 1    |
| en       | ORGANIZATION | 100%      | 66.7%  | 2 / 0 / 1    |
| en       | EDUCATION    | 100%      | 66.7%  | 2 / 0 / 1    |
| en       | LOCATION     | 100%      | 66.7%  | 2 / 0 / 1    |

These small authored regression scores do not estimate accuracy on arbitrary
user documents. The test includes explicit misses such as `Zephyr Quill`,
`Asterion expanded rapidly`, `ETHZ` and `Reykjavik` so dictionary limits remain
visible. Acceptance rows also test both sanitizers and unchanged controls.

On Node v26.13.0, Linux x64, five bounded groups, the median warm detector cost
was **0.0434 ms per 1 KiB** of ASCII employer prose; module loading plus factory
initialization took **48.6 ms** once. Cost excludes the sanitizer's other
recognizers and varies with text and hardware. No latency guarantee is implied.

## Compiled known-value measurements

On the same host and 1 KiB operational record, median complete `sanitize` cost
was **2.80 ms** without a list, **3.30 ms** with 500 compiled values and **8.56 ms**
with a plain array. A direct 500-value matching pass cost **0.73 ms**. Validation
cost was **0.00416 ms** without a list and **0.00356 ms** compiled (the difference
is measurement noise), below the allowed 10% of the no-list call, excluding
matching. Compilation skips per-record entry validation, normalization and regex
construction; matching itself still scales with list length and pipeline passes.

Reproduce with `node --max-old-space-size=384 experiments/issue-118/measure.mjs`.
The [raw results](case-studies/issue-118/measurements.json) include environment,
exact-span counts and measurement method. This fixed experiment uses no large
corpus, unbounded input, parallel builds or external analysis service.

## Single Latin names and Yandex Cloud credentials

Document rules recognize a capitalized Latin name after `candidate`, `recruiter`,
`applicant`, `Dear`, `Hi`, `Mr`/`Mr.`, `Ms`/`Ms.`, `Dr`/`Dr.`, or `message from`.
Honorifics count only when capitalized: lowercase `ms` (milliseconds), `mr` and
`dr` are not cues, and `Ms` right after a number is read as a unit, so
`took 30 ms Retry scheduled` and `see dr Drive mount` stay unchanged.
Only the name is replaced; punctuation and the cue remain. These rules work
without enabling Latin script matching. Finite generic heading nouns such as
`Stage` and `Status` are preserved: `Candidate Stage changed` and
`Request Failed: POST /api` stay unchanged. This is contextual recognition,
not universal English NER; unknown cue-free single names can remain.
Use `rules: { 'document-person-cue': false }` to disable this recognizer.

Native credential detection recognizes bare Yandex Cloud API keys (`AQVN`),
IAM tokens (`t1.` including optional base64 padding), static access key IDs
(`YCAJE`) and static secrets (`YC`). These provider rules apply in every profile
and do not require an assignment label. See the official
[token grammar](https://yandex.cloud/en/docs/iam/concepts/authorization/iam-token)
and [credential formats](https://yandex.cloud/en/docs/security/standard/authentication).
