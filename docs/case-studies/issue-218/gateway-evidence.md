# Pinned live gateway evidence

The deployment comparison uses upstream source and documentation retrieved on
2026-11-20. These observations identify the reviewed revision and code path.
They are a source review. Network deployments and performance were outside
this comparison.

## ai-proxy

- [README](https://github.com/lee-to/ai-proxy/blob/68bd496cbcd27d4103721f030fc84390b8f97bce/README.md#redaction)
  describes reverse proxy routing, plain CONNECT tunneling, opt-in CONNECT TLS
  inspection, request-local maps, and allowed personal categories for restore.
  It describes outbound WebSocket protection and says reply restoration is
  unavailable for WebSockets.
- [Proxy source](https://github.com/lee-to/ai-proxy/blob/68bd496cbcd27d4103721f030fc84390b8f97bce/src/proxy.rs#L369-L489)
  feeds upstream byte chunks into `StreamingRestore`, including responses with
  SSE content type. This is byte-stream restoration. The
  [WebSocket loop](https://github.com/lee-to/ai-proxy/blob/68bd496cbcd27d4103721f030fc84390b8f97bce/src/proxy.rs#L1434-L1516)
  applies separate redaction in both directions without rehydration, so the
  outbound-only wording in the README does not fully describe this revision.
- [Proxy failure path](https://github.com/lee-to/ai-proxy/blob/68bd496cbcd27d4103721f030fc84390b8f97bce/src/proxy.rs#L1829-L1865)
  forwards undecodable bodies unchanged. [Scan result flow](https://github.com/lee-to/ai-proxy/blob/68bd496cbcd27d4103721f030fc84390b8f97bce/src/proxy.rs#L1998-L2043)
  can forward without findings after scanner failure. The
  [model configuration](https://github.com/lee-to/ai-proxy/blob/68bd496cbcd27d4103721f030fc84390b8f97bce/README.md#local-model-scanner)
  describes a deterministic fallback as the default and a named `fail_closed`
  option. Its name alone does not establish upstream refusal.

## LiteLLM with Presidio

- [Guardrail source](https://github.com/BerriAI/litellm/blob/d3d649dac4d6870d14c1f2dee67f42ad9ad5bc40/litellm/proxy/guardrails/guardrail_hooks/presidio.py#L1092-L1180)
  calls the Presidio endpoints before inference and propagates pre-call errors.
  [Output handling](https://github.com/BerriAI/litellm/blob/d3d649dac4d6870d14c1f2dee67f42ad9ad5bc40/litellm/proxy/guardrails/guardrail_hooks/presidio.py#L1284-L1320)
  is optional. Placeholder values live in the request metadata.
- [Stream handling](https://github.com/BerriAI/litellm/blob/d3d649dac4d6870d14c1f2dee67f42ad9ad5bc40/litellm/proxy/guardrails/guardrail_hooks/presidio.py#L1670-L1739)
  assembles typed Chat Completions chunks before unmasking and emitting a
  reconstructed stream. Byte-mode SSE is replaced by chunk, and Responses
  completion events have a separate path. Failed chat stream processing can
  forward already buffered chunks.

## LLM Shield Proxy and the LiteLLM integration

- [Shield architecture](https://github.com/ninadphalak/LLM-Shield-Proxy/blob/ff5df7bdcce569498b7762a7edd72e59f9bfb343/website/docs/architecture.md#stage-4-streaming-rehydration)
  documents the separate vault and bounded incremental SSE restoration. The
  [standalone setup](https://github.com/ninadphalak/LLM-Shield-Proxy/blob/ff5df7bdcce569498b7762a7edd72e59f9bfb343/README.md)
  distinguishes client virtual keys from the configured upstream provider key.
- The [LiteLLM guardrail source](https://github.com/BerriAI/litellm/blob/d3d649dac4d6870d14c1f2dee67f42ad9ad5bc40/litellm/proxy/guardrails/guardrail_hooks/llm_shield_proxy/llm_shield_proxy.py#L233-L318)
  mints a private request vault ID and throws on scanner transport, status or
  schema errors. The [post-call streaming hook](https://github.com/BerriAI/litellm/blob/d3d649dac4d6870d14c1f2dee67f42ad9ad5bc40/litellm/proxy/guardrails/guardrail_hooks/llm_shield_proxy/llm_shield_proxy.py#L487-L559)
  works on parsed provider delta fields. It maintains separate carry for indexed
  choices and handles other provider stream shapes with dedicated restorers.

## token-proxy

- [README](https://github.com/zolderio/token-proxy/blob/8e64148f3077e553676c927f9d47624963b82595/README.md#streaming-support)
  documents Anthropic SSE. [Limitations](https://github.com/zolderio/token-proxy/blob/8e64148f3077e553676c927f9d47624963b82595/README.md#limitations)
  document two-hour in-memory eviction, a request-prefix session ID, text-only
  inspection and unauthenticated management endpoints.
- [Proxy source](https://github.com/zolderio/token-proxy/blob/8e64148f3077e553676c927f9d47624963b82595/token_proxy/proxy.py#L255-L391)
  parses events, uses separate text tail buffers for content-block indices,
  and buffers tool JSON fragments before assembly. Upstream authorization is
  separate from the session path. A strict scan-failure guarantee was unverified.

## CloakPipe

- [README](https://github.com/rohansx/cloakpipe/blob/b5a9a46be642ceb5c9027d88dcc4a79ba044affb/README.md#other-commands)
  lists the regex OpenAI/Anthropic HTTP proxy alongside the MCP gate. The
  [crate list](https://github.com/rohansx/cloakpipe/blob/b5a9a46be642ceb5c9027d88dcc4a79ba044affb/README.md#L669-L678)
  identifies the encrypted vault and JSONL/SQLite audit.
- [Handlers](https://github.com/rohansx/cloakpipe/blob/b5a9a46be642ceb5c9027d88dcc4a79ba044affb/crates/cloakpipe-proxy/src/handlers.rs#L24-L105)
  use configured upstream credentials with an optional session header for
  OpenAI pseudonym reuse. A pseudonymization error returns an error before the
  provider request. The [streaming implementation](https://github.com/rohansx/cloakpipe/blob/b5a9a46be642ceb5c9027d88dcc4a79ba044affb/crates/cloakpipe-proxy/src/streaming.rs)
  edits parsed SSE text deltas using shared vault state. The reviewed handlers
  did not establish a vault partition authenticated by the client principal.

## piast-gate

- [README](https://github.com/vissnia/piast-gate/blob/252edb605191e1485bfe12c2bbea0ef4a3e5cf55/README.md)
  documents Polish text NER, reversible pseudonyms, a configured client
  API-key map, and explicit unredacted tool and image paths.
- [Streaming use case](https://github.com/vissnia/piast-gate/blob/252edb605191e1485bfe12c2bbea0ef4a3e5cf55/application/use_cases/stream_chat_use_case.py#L80-L114)
  finishes prompt anonymization before opening upstream and passes its
  per-call map to the [text-delta deanonymizer](https://github.com/vissnia/piast-gate/blob/252edb605191e1485bfe12c2bbea0ef4a3e5cf55/application/services/stream_deanonymizer.py).
  An uncaught anonymization error aborts before upstream. A guarantee that all
  detector failures propagate from the detector layer was unverified.
