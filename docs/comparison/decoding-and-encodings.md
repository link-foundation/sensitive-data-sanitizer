# Decoding and encodings

[← Comparison overview](../COMPARISON.md). Sources: the decoder sections of
the [open-source secrets research](../case-studies/issue-128/research/open-source-secrets.md)
(Gitleaks 2.1, Betterleaks 2.2, TruffleHog 2.3, Kingfisher 2.6, Talisman 2.10)
and [COVERAGE.md](../COVERAGE.md#bounds-and-unsupported-inputs). Legend: **Y** supported, **P**
partial, **–** absent, **?** unverified.

## Feature matrix

| Encoding or obfuscation                                | This project                                  | Gitleaks                 | Betterleaks | TruffleHog | Kingfisher | Titus | detect-secrets | Secretlint | Talisman    | Presidio / PII tools |
| ------------------------------------------------------ | --------------------------------------------- | ------------------------ | ----------- | ---------- | ---------- | ----- | -------------- | ---------- | ----------- | -------------------- |
| base64 / base64url                                     | Y (also line-wrapped)                         | Y                        | Y           | Y          | Y          | ?     | –              | –          | P (detects) | –                    |
| Hex                                                    | Y                                             | Y                        | Y           | –          | –          | –     | –              | –          | P           | –                    |
| Percent (URL) encoding                                 | Y                                             | Y                        | Y           | –          | –          | –     | –              | –          | –           | –                    |
| HTML entities (numeric and basic named)                | Y                                             | –                        | –           | Y          | –          | –     | –              | –          | –           | –                    |
| JSON `\uXXXX` and escaped nested JSON                  | Y                                             | Y                        | Y           | Y          | –          | –     | –              | –          | –           | –                    |
| `\xNN` UTF-8 byte escapes                              | Y                                             | –                        | –           | –          | –          | –     | –              | –          | –           | –                    |
| `U+XXXX` runs                                          | Y                                             | P                        | P           | Y          | –          | –     | –              | –          | –           | –                    |
| `\u{X}`, `\UXXXXXXXX`, `\x{X}`, `%uXXXX`               | Y                                             | –                        | –           | Y          | –          | –     | –              | –          | –           | –                    |
| CSS escapes (`\74 \6f `)                               | Y                                             | –                        | –           | Y          | –          | –     | –              | –          | –           | –                    |
| Formatting tags splitting a token (`<em>`, `<span>`)   | Y (inline tags dropped, block tags → newline) | –                        | –           | Y          | –          | –     | –              | –          | –           | –                    |
| HTML attribute extraction (`href`, `data-*`, …)        | P (attribute text stays in the view)          | –                        | –           | Y          | –          | –     | –              | –          | –           | –                    |
| Zero-width and bidirectional format characters         | Y                                             | –                        | –           | Y          | –          | –     | –              | –          | –           | –                    |
| ANSI colour sequences                                  | Y                                             | –                        | –           | –          | –          | –     | –              | –          | –           | –                    |
| Unicode NFKC (fullwidth, mathematical letters, digits) | Y (also non-ASCII decimal digits)             | –                        | –           | –          | –          | –     | –              | –          | –           | P                    |
| UTF-16 read as bytes (NUL-interleaved)                 | Y                                             | –                        | ?           | Y          | Y          | ?     | –              | –          | –           | –                    |
| UTF-16 files with BOM, written back in UTF-16          | Y (CLI `redact` and `scan`)                   | –                        | ?           | Y (scan)   | Y (scan)   | ?     | –              | –          | –           | –                    |
| BOM-less UTF-16, UTF-32                                | –                                             | –                        | ?           | Y          | Y          | ?     | –              | –          | –           | –                    |
| Invalid UTF-8 preserved byte for byte                  | Y (plain logs and streams)                    | –                        | –           | –          | –          | –     | –              | –          | –           | –                    |
| Nested decoding                                        | Y (depth 2, bounded candidates)               | Y (`--max-decode-depth`) | Y           | Y          | ?          | ?     | –              | –          | –           | –                    |
| Re-encode the redacted payload (`preserveEncoding`)    | Y                                             | –                        | –           | –          | –          | –     | –              | –          | –           | –                    |
| Archives, Office, PDF, images                          | –                                             | P                        | P           | Y          | Y          | Y     | –              | –          | –           | P (Presidio image)   |

Gitleaks and Betterleaks decode `U+XXXX` in their codec but do not document it
(the **P** cells). TruffleHog keeps HTML attribute values as separate chunks;
here attribute text is part of the view, so a token in a `data-*` or `href`
attribute is still found, but attributes are not extracted into their own
scan.

## How decoding works here

- **Encoded runs** (base64, hex, percent, HTML entities, `\xNN`, JSON string
  content) are decoded in bounded candidates up to depth 2. A finding inside
  a decoded run redacts the whole original run unless
  [`preserveEncoding`](../API.md#transformations-and-confidence) is set, in which
  case the decoded payload is sanitized and re-encoded.
- **Escapes and obfuscation** (`\u{X}`, `U+` runs, CSS runs, formatting tags,
  zero-width characters, UTF-16 NUL bytes, ANSI sequences, NFKC) are handled
  by a detection view (`src/projection.js`) that maps every view character back
  to its original span. A finding inside a `U+` or CSS run covers the whole
  run.
- `decode: false` turns encoded-run decoding off.
- The CLI reads UTF-16LE/BE files with a byte order mark and writes the
  redacted result back in the same encoding.

## Tests taken from competitors

- TruffleHog `escaped_unicode`, `html` and `utf16` decoder tests (the payload
  is a generic secret written in all 8 escape formats) and Gitleaks/Betterleaks
  codec tests are in
  [open-source-secrets-cases.json](../case-studies/issue-128/research/open-source-secrets-cases.json).
- Regression tests: the `escape runs, NUL-interleaved text and HTML formatting`
  and `UTF-16 text files with a byte order mark` suites in `tests/sanitizer-issue-128-features.test.js`.

## Remaining gaps

- Double-encoded HTML entities (`&amp;#112;`), which TruffleHog decodes.
- BOM-less UTF-16 and UTF-32 detection.
- Separate scans of HTML attribute values.
- Archives, Office documents, PDF and images.
- Compressed or encrypted payloads (out of scope for a text redactor).
