# Competitor comparison

Review date: 2026-11-10. The research, sources and collected test cases are in
[the issue 128 case study](case-studies/issue-128/README.md). This page is the
high-level summary; each feature area has a detailed page:

| Feature area                                                   | Detailed page                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Credential rules, entropy, checksums, live verification        | [Secrets detection](comparison/secrets-detection.md)                     |
| Names, national IDs, contact data, context words, NER          | [PII detection](comparison/pii-detection.md)                             |
| redact, mask, hash, fake, encrypt, date shift, restore         | [Transformations](comparison/transformations.md)                         |
| base64, hex, percent, Unicode escapes, HTML, UTF-16            | [Decoding and encodings](comparison/decoding-and-encodings.md)           |
| allow lists, inline comments, template values, thresholds      | [Suppression and allow lists](comparison/suppression-and-allow-lists.md) |
| JSON reports, SARIF, offsets, pre-commit, CI                   | [Reporting and CI integration](comparison/reporting-and-ci.md)           |
| custom detectors, rule replacement, scanner bridges, callbacks | [Extensibility](comparison/extensibility.md)                             |
| offline use, streaming, Git history, platforms, limits         | [Deployment and operation](comparison/deployment.md)                     |
| competitor test cases run against this project                 | [Measured results](comparison/measured-results.md)                       |

Legend: **Y** supported, **P** partial, **–** absent or not documented, **?**
unverified. Competitor cells come from their source code, tests or
documentation as linked in the research files; marketing-only claims are marked
**?**.

## What changed in the market

- **Gitleaks** 8.30.1 is frozen (security fixes only). Its author now develops
  **Betterleaks**, which has 474 rules on `main`.
- **Nosey Parker** is archived; **Titus** replaces it. **Kingfisher** (MongoDB)
  is new and is the only open-source scanner found with offline checksum
  validation of provider tokens.
- **whispers** is archived.
- **Private AI** is now **Limina**; **Lakera** is part of Check Point;
  **Gretel** was acquired by NVIDIA; **Portkey** is part of Prisma AIRS.
- Newer open-source PII tools: **Rehydra**, **flare-redact**, **cloakrs**,
  **PasteGuard**, **pii-shield**, **packyme/privacy-filter** and the
  **openai/privacy-filter** model.

## Tools compared

| Group               | Tools                                                                                                                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open-source secrets | Gitleaks, Betterleaks, TruffleHog, Kingfisher, Titus, detect-secrets, Secretlint, ripsecrets, Trivy, Talisman, git-secrets, ggshield, whispers, secrets-patterns-db                                                                                              |
| Open-source PII     | Presidio, scrubadub, DataFog, LLM Guard, Philter/Phileas, OpenRedaction, redact-pii, @redactpii/node, pii-codex, pino/fast-redact, Rehydra, flare-redact, cloakrs, PasteGuard, pii-shield, packyme/privacy-filter                                                |
| Closed source       | Google Sensitive Data Protection, Azure AI Language PII, AWS Comprehend/Macie/CloudWatch Logs, GitHub secret scanning, GitGuardian, Nightfall, Limina, Skyflow, Tonic Textual, Protecto, Datadog, New Relic, Splunk/Elastic, Sentry, Cloudflare, Portkey, Lakera |

## Overview matrix

| Capability                                 | This project                                                | Gitleaks / Betterleaks | TruffleHog | Kingfisher | detect-secrets | Secretlint | Presidio | OpenRedaction | LLM Guard | Google SDP | Azure PII | Nightfall | Limina |
| ------------------------------------------ | ----------------------------------------------------------- | ---------------------- | ---------- | ---------- | -------------- | ---------- | -------- | ------------- | --------- | ---------- | --------- | --------- | ------ |
| Credential provider rules                  | Y (51 native + 221 Gitleaks + 203 Betterleaks + Secretlint) | Y (222 / 474)          | Y (800+)   | Y (503)    | P (26 plugins) | Y (27)     | –        | P             | P         | P          | –         | Y         | –      |
| Personal data detection                    | Y                                                           | –                      | –          | P          | –              | –          | Y        | Y             | Y         | Y          | Y         | Y         | Y      |
| Rewrites the text (not only reports)       | Y                                                           | P                      | –          | P          | –              | P          | Y        | Y             | Y         | Y          | Y         | Y         | Y      |
| Reversible output                          | Y (placeholders, AES-256-GCM)                               | –                      | –          | –          | –              | –          | Y        | Y             | Y         | Y          | –         | Y         | Y      |
| Offline checksum confidence (CRC32, Luhn)  | Y                                                           | –                      | –          | Y          | –              | –          | Y        | Y             | Y         | Y          | ?         | ?         | ?      |
| Live credential verification               | – (by design)                                               | P (Betterleaks)        | Y          | Y          | P              | –          | –        | –             | –         | –          | –         | –         | –      |
| Encoded content (base64, hex, escapes)     | Y                                                           | Y                      | Y          | P          | –              | –          | –        | –             | –         | –          | –         | –         | –      |
| Structured JSON/JSONL streaming            | Y                                                           | –                      | –          | –          | –              | –          | P        | ?             | –         | Y          | –         | Y         | Y      |
| Allow list and inline suppression          | Y                                                           | Y                      | Y          | Y          | Y              | Y          | Y        | Y             | Y         | Y          | Y         | Y         | Y      |
| Per-type thresholds                        | Y                                                           | –                      | –          | P          | –              | –          | Y        | ?             | P         | Y          | Y         | Y         | ?      |
| Custom declarative detectors with hotwords | Y                                                           | P (no hotwords)        | P          | P          | P              | P          | Y        | Y             | P         | Y          | P         | Y         | Y      |
| SARIF output                               | Y                                                           | Y / ?                  | Y          | Y          | –              | Y          | –        | –             | –         | –          | –         | –         | –      |
| Pre-commit hook                            | Y                                                           | Y                      | Y          | Y          | Y              | Y          | –        | –             | –         | –          | –         | –         | –      |
| Git history audit and rewrite              | Y (audit + rewrite)                                         | P (audit)              | P (audit)  | P (audit)  | –              | –          | –        | –             | –         | –          | –         | –         | –      |
| Runs without network or account            | Y                                                           | Y                      | Y          | Y          | Y              | Y          | Y        | Y             | Y         | –          | P         | –         | P      |
| ML named-entity recognition                | P (optional `@nlpjs/ner` detector, Presidio bridge)         | –                      | –          | –          | –              | –          | Y        | –             | Y         | Y          | Y         | Y         | Y      |
| Images, PDF, Office, archives              | –                                                           | P                      | Y          | Y          | –              | –          | P        | ?             | –         | Y          | –         | Y         | Y      |

The full tables with every tool are on the detailed pages.

## Measured with competitor test cases

853 cases were collected from competitor test suites and documentation
(open-source PII 371, open-source secrets 298, closed source 184) and are run by
[`experiments/issue-128/probe-cases.mjs`](../experiments/issue-128/probe-cases.mjs).
A miss is a positive case whose sensitive value survives; an over-redaction is
a negative case that was changed.

| Case set                      | Before issue 128 (main) | After issue 128 | Detail                                                     |
| ----------------------------- | ----------------------- | --------------- | ---------------------------------------------------------- |
| Open-source PII, default      | 109 misses / 20 over    | 60 / 16         | [Measured results](comparison/measured-results.md#pii)     |
| Open-source secrets, default  | 34 / 91                 | 15 / 83         | [Measured results](comparison/measured-results.md#secrets) |
| Closed source, default        | 48 / 15                 | 41 / 15         | [Measured results](comparison/measured-results.md#closed)  |
| Open-source PII, strict       | 88 / 32                 | 43 / 28         |                                                            |
| Open-source secrets, paranoid | 27 / 94                 | 8 / 85          |                                                            |

Most remaining over-redactions are deliberate: a log redactor removes
placeholder-like passwords, hashes and ciphertext that a code scanner may
ignore, because a wrong "safe" decision leaks data. The measured-results page
classifies every remaining case.

## Not supported, by design

- Live credential verification or revocation: it sends the secret to its
  provider.
- Uploading text to a cloud service.
- Proprietary ML models; the [Presidio bridge](API.md#optional-offline-recognition)
  and custom detectors accept local models.

## Remaining gaps

Each detailed page ends with its own list. The largest are images, PDF,
Office files and archives; ML-only entity types; generic dates and IP addresses
(available only as opt-in context rules); NIST FF1 format-preserving
encryption; JUnit/CSV report formats; and remote sources such as S3 or Slack.
