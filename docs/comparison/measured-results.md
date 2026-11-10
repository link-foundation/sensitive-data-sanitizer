# Measured results on competitor test cases

[← Comparison overview](../COMPARISON.md). The cases come from the
competitors' own test suites, fixtures and documentation examples, collected in
[`docs/case-studies/issue-128/research/`](../case-studies/issue-128/research/):

- `open-source-pii-cases.json`: Presidio, scrubadub, LLM Guard, OpenRedaction,
  redact-pii, DataFog, Phileas, Philter, pino redaction and Rehydra.
- `open-source-secrets-cases.json`: Gitleaks, Betterleaks, TruffleHog,
  detect-secrets, ripsecrets, whispers and Kingfisher.
- `closed-source-cases.json`: Google Sensitive Data Protection, Azure AI
  Language PII, Amazon Comprehend and CloudWatch Logs, GitHub secret scanning,
  GitGuardian, Lakera Guard, Limina (Private AI), Tonic Textual, Portkey,
  Splunk and Sentry Relay.

Each case has an input, the values that must disappear (`sensitive`) or a
`negative` flag when the competitor leaves the input unchanged. A **miss** is a
sensitive value still present in the output; an **over-redaction** is a
negative case whose output changed. **Skipped** cases need a feature the
probe cannot express, such as a caller-supplied custom rule or a binary file.

Credential-shaped inputs in the case files are stored in split form and
rebuilt at run time, so the repository never contains a literal token.

## Totals

Run on the final branch state (`node experiments/issue-128/probe-summary.mjs`):

| Case set            | Options                                 | Total | Skipped | Misses | Over-redactions |
| ------------------- | --------------------------------------- | ----: | ------: | -----: | --------------: |
| open-source-pii     | default                                 |   371 |       0 |     60 |              16 |
| open-source-pii     | strict, publicKnowledge:false           |   371 |       0 |     43 |              28 |
| open-source-pii     | strict, publicKnowledge:false, paranoid |   371 |       0 |     43 |              29 |
| open-source-secrets | default                                 |   298 |      15 |     15 |              83 |
| open-source-secrets | strict, publicKnowledge:false           |   298 |      15 |     15 |              83 |
| open-source-secrets | strict, publicKnowledge:false, paranoid |   298 |      15 |      8 |              85 |
| closed-source       | default                                 |   184 |       5 |     41 |              15 |
| closed-source       | strict, publicKnowledge:false           |   184 |       5 |     31 |              18 |
| closed-source       | strict, publicKnowledge:false, paranoid |   184 |       5 |     30 |              18 |

Before the issue 128 changes the same case files measured 109 misses and 20
over-redactions (PII), 34 and 91 (secrets) and 48 and 15 (closed source) with
default options.

Per tool, default options (`node experiments/issue-128/probe-tools.mjs`):

| Case set            | Tool                   | Misses | Over-redactions |
| ------------------- | ---------------------- | -----: | --------------: |
| open-source-pii     | datafog                |     18 |               8 |
| open-source-pii     | llm-guard              |      1 |               2 |
| open-source-pii     | openredaction          |      2 |               4 |
| open-source-pii     | phileas                |      1 |               0 |
| open-source-pii     | philter                |      1 |               0 |
| open-source-pii     | pino-redact            |      1 |               0 |
| open-source-pii     | presidio               |     23 |               2 |
| open-source-pii     | redact-pii             |      7 |               0 |
| open-source-pii     | rehydra                |      1 |               0 |
| open-source-pii     | scrubadub              |      5 |               0 |
| open-source-secrets | betterleaks            |      3 |              29 |
| open-source-secrets | detect-secrets         |      1 |              12 |
| open-source-secrets | gitleaks               |      1 |              24 |
| open-source-secrets | kingfisher             |      0 |               1 |
| open-source-secrets | ripsecrets             |      3 |               8 |
| open-source-secrets | trufflehog             |      4 |               0 |
| open-source-secrets | whispers               |      3 |               9 |
| closed-source       | aws-cloudwatch-logs    |      1 |               0 |
| closed-source       | aws-comprehend         |      2 |               0 |
| closed-source       | azure-ai-language-pii  |      2 |               0 |
| closed-source       | gitguardian            |      0 |               7 |
| closed-source       | github-secret-scanning |      3 |               0 |
| closed-source       | google-sdp             |      3 |               1 |
| closed-source       | lakera-guard           |      6 |               7 |
| closed-source       | limina-private-ai      |      3 |               0 |
| closed-source       | portkey                |      2 |               0 |
| closed-source       | sentry-relay           |     16 |               0 |
| closed-source       | splunk                 |      1 |               0 |
| closed-source       | tonic-textual          |      2 |               0 |

Tools not listed had no misses and no over-redactions.

## PII

The 60 default misses fall into these groups:

- **Numbers without a context word (19).** Presidio's recognizers accept a
  lone `987-65-4321`, `121000358`, `44051401458` or `3123 4567 8909`; DataFog,
  scrubadub, OpenRedaction and LLM Guard have similar cases. Here a
  checksum-valid number needs a nearby label, because logs are full of order
  numbers, timestamps and IDs. With a label they are redacted:
  `SSN 987-65-4321`, `routing number 121000358`, `PESEL 44051401458` and
  `Aadhaar 3123 4567 8909` all become `[REDACTED]`.
- **IP addresses (12).** RFC 1918, loopback, link-local, documentation ranges
  and well-known public resolvers are kept by default, because they identify
  no person. `publicKnowledge: false` redacts them; the strict variant
  removes 11 of the 12. The last one is redact-pii's nine-group string, which
  is not a valid IPv6 address.
- **Dates (9).** DataFog redacts every date, including `Fiscal year 2024`.
  Dates are redacted here when a label marks them as personal (birth, visit,
  document dates) or in strict mode, which removes 5 of these misses.
- **URLs and bare domains (5).** Presidio, scrubadub and redact-pii treat every
  URL as personal data. URLs are kept here unless they carry credentials,
  personal query values or a known personal value.
- **UUIDs (1).** Presidio treats a request UUID as an identifier; DataFog
  treats the same input as a negative. UUIDs are kept because trace and
  request IDs make a sanitized log useful.
- **Caller rules or output formats (4).** Rehydra's XML tags, pino key paths,
  redact-pii's custom `ANIMAL` redactor and OpenRedaction's `customPatterns`.
  The probe runs without caller rules; `createPatternDetector` and the
  structured JSON field policy cover them.
- **Other formats (10).** A UK national phone number and a single first name
  without a label, a GB driving licence with spaces, a lowercase UK postcode,
  redact-pii's digit-run redactor, a USPS tracking number with spaces,
  Philter's README sentence, a ZIP code at the start of a line, an accented
  name and two values with no separator (`john@acme.com123-45-6789`).

The 16 over-redactions are inputs that the competitor rejects by checksum or
format and this project redacts anyway: invalid SSN areas (`000`, `666`), a
Luhn-failing card, an NHS number with a failing mod-11 check,
`user@domain@domain.com`. Redacting a value that only looks invalid is the
safer failure for logs.

The probe also found one defect, fixed in this branch: an IPv4 address
followed by a full stop (`my ip: 8.8.4.5.`) was not detected. A regression
test is in `tests/sanitizer-issue-128-features.test.js`.

## Secrets

The 15 default misses:

- **Encoded prose (4).** Gitleaks and Betterleaks decoder unit tests encode
  plain words (`longer-encoded-secret-test`) in base64 and base64url. The
  decoded text has no key name and no credential shape. Paranoid mode
  redacts them.
- **TruffleHog HTML cases (4).** A token split across `<span>` elements that
  carry a style attribute, plain-text tokens with zero-width characters and
  no key name, and an `src` attribute query parameter. The escape-run and
  formatting-tag cases from the same suite pass.
- **whispers, ripsecrets and detect-secrets fixtures (7).** htpasswd lines,
  a `--proxy-user` value, a symbols-only keyword value, a random string under
  a dictionary key and two masks (`ACxxxx…`, `xxxx`) that ripsecrets reports
  even though they are masks. Paranoid mode redacts three of them.

The 83 over-redactions are negatives where the competitor drops a value by
heuristic and this project redacts it:

- Gitleaks generic-api-key and curl false-positive fixtures (24): version
  hashes, Jenkins credential IDs, public keys, CSRF tokens, `curl -u test:test`.
- Betterleaks generic-password and credential-URI fixtures (29): ciphertexts
  (SOPS, Ansible Vault, Jasypt, Vault transit), password hashes, algorithm
  names and URIs on `example.com`.
- detect-secrets filters (12): sequential strings, UUIDs, indirect references,
  and two `pragma: allowlist` comments that work only with
  `inlineAllow: true`.
- ripsecrets and whispers "none" or "compliant" fixtures (17): values equal to
  the key name, constant names, prose instructions.
- Kingfisher's `kingfisher:ignore` comment (1), honoured with
  `inlineAllow: true`.

These are policy differences. A scanner that blocks commits wants few false
positives. A redactor that publishes logs fails closed, so a value next to a
`password` or `secret` key is removed unless it is a template, a mask or an
already-redacted marker. Template and mask values (`${PASSWORD}`, `<password>`,
`****`) are skipped since issue 128.

## Closed

The 41 default closed-source misses:

- **Sentry Relay (16):** loopback IPs (4), UUIDs (4), an IMEI without a label
  (3) and a card number that fails the Luhn check (5). See [PII](#pii) for
  why these are kept.
- **Lakera Guard (6):** private and documentation IPs, a misspelled name and
  space-separated SSNs without a label.
- **Caller-defined rules (8):** Google custom regex with hotwords, CloudWatch
  custom data identifiers, three GitHub custom patterns, a Splunk `SEDCMD`
  rule, a Portkey regex guardrail and a Limina block-list regex. Each is
  reproducible with `createPatternDetector`; the probe runs without caller
  rules.
- **NER-only entities (7):** organisations, dates in prose, conditions, ages,
  person types and spelled-out names from Limina, Tonic Textual, Amazon
  Comprehend and Azure. The optional `/ner` detector and the Presidio bridge
  cover part of this.
- **Date shifting (2):** Google `dateShiftConfig` replaces dates with shifted
  dates; dates here are redacted or replaced with fake dates, not shifted.
- **Other (2):** Azure's weak SSN container rule (nine bare digits) and
  Portkey's numbered placeholder format.

The 15 over-redactions are GitGuardian negatives (encrypted-looking, short and
low-entropy passwords, `\u` escapes) and Lakera negatives (placeholder names,
non-US phones, invalid IBANs). The same fail-closed policy applies.

## Reproduce

```sh
node experiments/issue-128/probe-summary.mjs
node experiments/issue-128/probe-tools.mjs
node experiments/issue-128/probe-cases.mjs \
  docs/case-studies/issue-128/research/open-source-pii-cases.json \
  --options '{"strict":true,"publicKnowledge":false}'
```

`probe-cases.mjs` prints every miss and over-redaction with the input, the
expected values and the output; `--json` prints the machine-readable result.
