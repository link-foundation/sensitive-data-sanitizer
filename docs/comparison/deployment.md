# Deployment and operation

[← Comparison overview](../COMPARISON.md). Sources: the per-tool notes in the
[open-source secrets research](../case-studies/issue-128/research/open-source-secrets.md),
[open-source PII research](../case-studies/issue-128/research/open-source-pii.md)
and [closed-source research](../case-studies/issue-128/research/closed-source.md).
Legend: **Y** supported, **P** partial, **–** absent, **?** unverified.

## Feature matrix

| Feature                                | This project                                            | Gitleaks / Betterleaks     | TruffleHog       | Kingfisher             | detect-secrets | Presidio       | OpenRedaction | LLM Guard   | Google SDP | Azure PII                  | Nightfall | Limina           |
| -------------------------------------- | ------------------------------------------------------- | -------------------------- | ---------------- | ---------------------- | -------------- | -------------- | ------------- | ----------- | ---------- | -------------------------- | --------- | ---------------- |
| Runs offline, no account               | Y                                                       | Y                          | Y (no verify)    | Y (no validate)        | Y              | Y              | Y             | Y           | –          | P (containers)             | –         | P (container)    |
| Never sends text or secrets out        | Y (no network code in the core)                         | P (Betterleaks validation) | – (verification) | – (validation)         | P              | Y              | Y             | Y           | –          | –                          | –         | P                |
| Language / runtime                     | JavaScript (Node 22.13+, Bun tested)                    | Go                         | Go               | Rust                   | Python         | Python         | TypeScript    | Python      | REST       | REST / container           | REST      | REST / container |
| Library API                            | Y (ESM, TypeScript types)                               | Y (Go)                     | P                | Y (Rust, Python, Node) | Y              | Y              | Y             | Y           | Y (SDKs)   | Y (SDKs)                   | Y (SDKs)  | Y (SDKs)         |
| CLI                                    | Y (`redact`, `scan`, `history`)                         | Y                          | Y                | Y                      | Y              | P              | Y             | –           | –          | –                          | –         | –                |
| Rewrites files atomically              | Y (`--in-place`, `--output`, mode 0600)                 | –                          | –                | –                      | –              | –              | –             | –           | n/a        | n/a                        | n/a       | n/a              |
| Streaming large inputs                 | Y (`--stream`, 1 GiB, bounded workers)                  | Y                          | Y                | Y                      | –              | P (batch)      | ?             | –           | P (jobs)   | P (batch, 5 120 chars/doc) | Y         | P                |
| Structured JSON / JSONL                | Y (types kept, key policy, two-pass identity)           | –                          | –                | –                      | –              | P (structured) | P             | –           | Y (tables) | –                          | Y         | Y                |
| Git history audit                      | Y (blobs, messages, authors, tags, reflog)              | Y                          | Y                | Y                      | –              | –              | –             | –           | –          | –                          | –         | –                |
| Git history rewrite                    | Y (`history rewrite`, preview then `--apply`)           | –                          | –                | –                      | –              | –              | –             | –           | –          | –                          | –         | –                |
| Remote sources (GitHub, S3, Slack, …)  | –                                                       | Y (Betterleaks)            | Y                | Y                      | –              | –              | –             | –           | Y          | –                          | Y         | –                |
| Archives, Office, PDF, images          | –                                                       | P                          | Y                | Y                      | –              | P (image)      | ?             | –           | Y          | –                          | Y         | Y                |
| Hard input and finding limits          | Y (fail closed)                                         | P                          | P                | P                      | –              | –              | ?             | –           | Y (quotas) | Y (quotas)                 | Y         | ?                |
| Outbound hooks (Sentry, HTTP payloads) | Y (`createSentryBeforeSend`, `createOutboundSanitizer`) | –                          | –                | –                      | –              | –              | P             | Y (LLM I/O) | –          | –                          | Y         | Y                |

## Operating model here

- The core library makes no network requests. Optional bridges run local
  binaries (Gitleaks, TruffleHog, a Presidio Python script) with a 30-second
  timeout and a 10 MiB output cap; failures block output.
- Limits fail closed: 32 MiB whole-text input, 100 000 findings, 10 000 files;
  `--stream` allows 1 GiB with 8 MiB JSONL records
  ([README](../../README.md#cli), [limits](../COVERAGE.md#bounds-and-unsupported-inputs)).
- Exit codes: 0 success, 1 findings, 2 error or incomplete scan.
- `history` audits a repository without changing refs; `history rewrite`
  works on a fresh mirror clone and never pushes
  ([history guide](../HISTORY-REMEDIATION.md)).

## Remaining gaps

- Archives, Office documents, PDF and images.
- Remote sources such as GitHub organisations, S3 buckets or Slack.
- Live verification is excluded by design.
