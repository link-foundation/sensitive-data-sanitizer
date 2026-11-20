# Deployment and operation

[← Comparison overview](../COMPARISON.md). Sources: the per-tool notes in the
[open-source secrets research](../case-studies/issue-128/research/open-source-secrets.md),
[open-source PII research](../case-studies/issue-128/research/open-source-pii.md)
and [closed-source research](../case-studies/issue-128/research/closed-source.md).
Legend: **Y** supported, **P** partial, **–** absent, **?** unverified.

## Feature matrix

| Feature                                | This project                                                     | Gitleaks / Betterleaks     | TruffleHog       | Kingfisher             | detect-secrets | Presidio       | OpenRedaction | LLM Guard   | Google SDP | Azure PII                  | Nightfall | Limina           |
| -------------------------------------- | ---------------------------------------------------------------- | -------------------------- | ---------------- | ---------------------- | -------------- | -------------- | ------------- | ----------- | ---------- | -------------------------- | --------- | ---------------- |
| Runs offline, no account               | Y                                                                | Y                          | Y (no verify)    | Y (no validate)        | Y              | Y              | Y             | Y           | –          | P (containers)             | –         | P (container)    |
| Offline data path                      | Y (default scans; separate opt-in verifier)                      | P (Betterleaks validation) | – (verification) | – (validation)         | P              | Y              | Y             | Y           | –          | –                          | –         | P                |
| Language / runtime                     | JavaScript (Node 22.13+, Bun tested)                             | Go                         | Go               | Rust                   | Python         | Python         | TypeScript    | Python      | REST       | REST / container           | REST      | REST / container |
| Library API                            | Y (ESM, TypeScript types)                                        | Y (Go)                     | P                | Y (Rust, Python, Node) | Y              | Y              | Y             | Y           | Y (SDKs)   | Y (SDKs)                   | Y (SDKs)  | Y (SDKs)         |
| CLI                                    | Y (`redact`, `scan`, `history`)                                  | Y                          | Y                | Y                      | Y              | P              | Y             | –           | –          | –                          | –         | –                |
| Rewrites files atomically              | Y (`--in-place`, `--output`, mode 0600)                          | –                          | –                | –                      | –              | –              | –             | –           | n/a        | n/a                        | n/a       | n/a              |
| Streaming large inputs                 | Y (`--stream`, 1 GiB, bounded workers)                           | Y                          | Y                | Y                      | –              | P (batch)      | ?             | –           | P (jobs)   | P (batch, 5 120 chars/doc) | Y         | P                |
| Structured JSON / JSONL                | Y (types kept, key policy, two-pass identity)                    | –                          | –                | –                      | –              | P (structured) | P             | –           | Y (tables) | –                          | Y         | Y                |
| Git history audit                      | Y (blobs, messages, authors, tags, reflog, revision/date scopes) | Y                          | Y                | Y                      | –              | –              | –             | –           | –          | –                          | –         | –                |
| Git history rewrite                    | Y (`history rewrite`, preview then `--apply`)                    | –                          | –                | –                      | –              | –              | –             | –           | –          | –                          | –         | –                |
| Remote sources (GitHub, S3, Slack, …)  | –                                                                | Y (Betterleaks)            | Y                | Y                      | –              | –              | –             | –           | Y          | –                          | Y         | –                |
| Archives, Office, PDF, images          | P (ZIP, TAR and GZIP text members)                               | P                          | Y                | Y                      | –              | P (image)      | ?             | –           | Y          | –                          | Y         | Y                |
| Hard input and finding limits          | Y (fail closed)                                                  | P                          | P                | P                      | –              | –              | ?             | –           | Y (quotas) | Y (quotas)                 | Y         | ?                |
| Outbound hooks (Sentry, HTTP payloads) | Y (`createSentryBeforeSend`, `createOutboundSanitizer`)          | –                          | –                | –                      | –              | –              | P             | Y (LLM I/O) | –          | –                          | Y         | Y                |

## Live LLM gateways

Source and documentation review with [pinned revisions and evidence](../case-studies/issue-218/gateway-evidence.md).
Transport rechunking refers to HTTP body bytes. Delta rechunking refers to
token fragments separated by complete, decoded provider events.

| Project and deployment                                                                        | Credential and map ownership                                                                                                 | Reply restoration                                                                                                                                    | Request scan failure                                                                                                                  |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| This project · scanner API and [adapter example](../LIVE-REPLIES.md)                          | The gateway authenticates session ownership, manages upstream credentials and supplies its private map.                      | Bounded UTF-8 cursor for transport splits, plus one text cursor per decoded field or index for JSON/SSE. Credential entries stay masked.             | A required detector error blocks sanitization. The example model adapter offers an explicit deterministic-only fallback.              |
| ai-proxy · reverse proxy plus CONNECT tunneling or opt-in TLS inspection                      | Provider auth headers follow the upstream route; the restorable map belongs to an active request. Blind CONNECT cannot scan. | Bounded rolling HTTP byte buffer for JSON/SSE content. WebSocket inspection redacts frames without reply rehydration.                                | Optional models default to deterministic fallback. The pinned proxy can forward undecodable bodies or scan failures with no findings. |
| LiteLLM + Presidio · gateway guardrail backed by analyzer and anonymizer services             | Gateway auth is separate from the placeholder map in request metadata.                                                       | Optional full reply parsing. Chat typed deltas are assembled and emitted again; native byte SSE and Responses completion events take separate paths. | Pre-call guardrail errors propagate.                                                                                                  |
| LLM Shield Proxy · standalone gateway and LiteLLM guardrail integration                       | Distinct virtual and upstream keys in standalone mode. The guardrail mints a per-request ID in the local Shield vault.       | Incremental SSE. The LiteLLM integration can carry token fragments across decoded provider deltas, tracking choices and tool calls separately.       | The LiteLLM guardrail refuses upstream forwarding on scanner transport, status or schema errors.                                      |
| token-proxy · Anthropic gateway                                                               | Upstream auth is separate from path-based sessions with two-hour in-memory eviction. Management APIs have no authentication. | SSE text-delta tail buffer per content block; separately assembled tool JSON.                                                                        | A strict scan-failure policy was unverified.                                                                                          |
| CloakPipe · OpenAI and Anthropic regex HTTP proxy with encrypted vault and JSONL/SQLite audit | Configured provider key and optional OpenAI session header. The reviewed reply path uses the application vault.              | Edits parsed OpenAI and Anthropic text deltas with a carry buffer. Per-choice isolation was unverified.                                              | A reported pseudonymization error aborts forwarding for the reviewed handlers.                                                        |
| piast-gate · Polish NER text gateway                                                          | Client API key and configured provider auth are separate. Reversible text mappings are local to a chat call.                 | Text-delta pseudonym restoration and lightweight output checks. Tool arguments, tool results and images can pass unredacted.                         | Anonymization runs before forwarding. Strict handling of all detector failures was unverified.                                        |

## Operating model here

- Default scans make no network requests. Optional bridges run local
  binaries (Gitleaks, TruffleHog, a Presidio Python script) with a 30-second
  timeout and a 10 MiB output cap; failures block output.
- [Opt-in credential verification](../VERIFICATION.md) sends a caller-supplied
  credential to its named provider for a read-only operation. Revocation and
  rotation are unavailable.
- Limits fail closed: 32 MiB whole-text input, 100 000 findings, 10 000 files;
  `--stream` allows 1 GiB with 8 MiB JSONL records
  ([README](../../README.md#cli), [limits](../COVERAGE.md#bounds-and-unsupported-inputs)).
- Exit codes: 0 success, 1 findings, 2 error or incomplete scan.
- `history` audits a repository without changing refs; `history rewrite`
  works on a fresh mirror clone and never pushes
  ([history guide](../HISTORY-REMEDIATION.md)).

## Remaining gaps

- Archive formats outside ZIP, TAR and GZIP, plus Office/PDF text extraction and OCR.
- Remote sources such as GitHub organisations, S3 buckets or Slack.
- Live checks are [explicitly opt-in](../VERIFICATION.md) for twelve providers;
  paired credentials and other token types remain unsupported.
