# PII detection

[← Comparison overview](../COMPARISON.md). Sources:
[open-source PII research](../case-studies/issue-128/research/open-source-pii.md)
and [closed-source research](../case-studies/issue-128/research/closed-source.md).
Legend: **Y** supported, **P** partial or plugin, **–** absent, **?**
unverified.

## Open-source detection features

| Feature                                           | This project                                          | Presidio              | scrubadub    | DataFog  | LLM Guard        | Philter/Phileas | OpenRedaction | redact-pii     | pino / @pinojs | Rehydra  | flare-redact | cloakrs     |
| ------------------------------------------------- | ----------------------------------------------------- | --------------------- | ------------ | -------- | ---------------- | --------------- | ------------- | -------------- | -------------- | -------- | ------------ | ----------- |
| Regex patterns                                    | Y                                                     | Y                     | Y            | Y        | Y                | Y               | Y (570+)      | Y              | –              | Y        | Y            | Y           |
| Checksum validation                               | Y (Luhn, mod-11, mod-97, Verhoeff, 41 national rules) | Y                     | P (Luhn)     | P        | Y (via Presidio) | Y               | Y             | –              | –              | ?        | Y (Luhn)     | Y           |
| Context words and windows                         | Y (built in; configurable in pattern detectors)       | Y                     | P            | –        | Y                | Y               | Y             | P (greetings)  | –              | ?        | P            | ?           |
| Confidence scores                                 | Y                                                     | Y                     | –            | P        | Y                | Y               | Y             | –              | –              | ?        | –            | ?           |
| ML NER                                            | P (optional `@nlpjs/ner`, Presidio bridge)            | Y                     | P            | Y        | Y                | Y               | –             | P (Google DLP) | –              | Y (ONNX) | –            | –           |
| Allow list                                        | Y (whole value, string or regex)                      | Y                     | –            | Y        | Y                | Y               | Y             | –              | –              | ?        | Y            | Y (exclude) |
| Deny list / known values                          | Y (`knownPersonal`, `denyList`)                       | Y                     | Y            | –        | Y                | Y               | Y             | Y              | Y (paths)      | ?        | ?            | ?           |
| False-positive heuristics                         | Y (timestamps, epochs, versions, public entities)     | P                     | –            | Y        | –                | P               | Y             | –              | n/a            | ?        | ?            | ?           |
| Key-name (structured) redaction                   | Y (JSON fields, caller-declared fields)               | P                     | –            | –        | –                | –               | P             | –              | Y              | –        | Y            | Y           |
| Names from courtesy titles, greetings and phrases | Y                                                     | P (NER)               | P (NER)      | P (NER)  | P (NER)          | P               | P             | Y              | –              | P (NER)  | –            | –           |
| Obfuscated emails (`at`/`[AT]`)                   | Y                                                     | –                     | Y            | –        | Y                | –               | ?             | –              | –              | ?        | Y            | ?           |
| Grammatical forms of names                        | Y (Russian declension)                                | –                     | –            | –        | –                | –               | –             | –              | –              | –        | –            | –           |
| Languages                                         | multilingual names and labels                         | many (per recognizer) | en + locales | en (+de) | en, zh           | en              | multi-region  | en             | n/a            | multi    | 24 (labels)  | ?           |

## Closed-source detection features

| Feature                       | This project                                   | Google SDP | Azure PII      | AWS Comprehend | Nightfall | Limina | Skyflow | Tonic | Datadog | Sentry |
| ----------------------------- | ---------------------------------------------- | ---------- | -------------- | -------------- | --------- | ------ | ------- | ----- | ------- | ------ |
| Built-in types                | native rules + 214/180/36 catalog names        | ~214       | ~182           | 36             | ~150      | 50+    | 60      | 44    | 90+ (?) | 19     |
| Hotword likelihood adjustment | Y (`context`, `contextWindow`, `contextBoost`) | Y          | P (containers) | P (Macie)      | Y         | –      | –       | –     | Y       | –      |
| Custom regex types            | Y (`createPatternDetector`)                    | Y          | P              | P (Macie)      | Y         | Y      | Y       | –     | Y       | Y      |
| Custom dictionary types       | Y (`denyList`, `knownPersonal`)                | Y          | –              | –              | Y         | Y      | Y       | –     | –       | –      |
| Exclusion rules               | Y (`allowList`)                                | Y          | Y              | P (Macie)      | Y         | Y      | Y       | –     | Y       | P      |
| Per-type thresholds           | Y (`minConfidenceByType`)                      | Y          | Y              | –              | Y         | –      | –       | –     | –       | –      |
| Explicit catalog labels       | Y (Google, Azure, AWS names)                   | n/a        | n/a            | n/a            | –         | –      | –       | –     | –       | –      |

The project recognizes the 214 Google infoType names, 180 Azure entity names and
36 AWS entity names when a document labels a value with them (for example
`US_SOCIAL_SECURITY_NUMBER: …`). It does not reproduce the vendors' models.

## Added for issue 128

- National, tax, bank and device identifiers tested by Presidio, OpenRedaction
  and Phileas (for example `KR_RRN`, `PL_PESEL`, `SE_PERSONNUMMER`, `AU_TFN`,
  `IN_GSTIN`, `TH_TNIN`, `AE_EMIRATES_ID`, `SA_NATIONAL_ID`, `IL_ID_NUMBER`,
  `SWIFT_CODE`, `IMEI`, `VIN`), each with its checksum where one exists.
- Context-gated identifiers (OpenRedaction's Steam, Emirates and Saudi IDs) and
  Google-style hotword boosts for custom patterns.
- Courtesy-title names, more street suffixes, UK postcodes in context, and
  phrases such as `My name is …` from scrubadub, redact-pii and LLM Guard tests.
- `createIdentifierDetector` and the exported `identifierChecks` let callers
  add or replace national rules.

## Remaining gaps

- Names without any cue (title, label, greeting, gazetteer entry) need an NER
  model; the optional detectors are the supported route.
- Generic dates, IP addresses and UUIDs are not personal data by default.
  Competitors disagree (Presidio reports UUIDs, DataFog treats them as
  negatives). Callers can enable them with a pattern detector.
- Adjacent values with no separator (`john@acme.com123-45-6789`, a DataFog
  edge case) are not split.
- Conditional policies such as Phileas "ZIP only if population < N" are not
  supported.
