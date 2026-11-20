# Live LLM request and reply adapters

A live gateway can sanitize each outbound request with a private placeholder
map and restore known personal placeholders in replies to the authenticated
session. The package provides text restoration and detector contracts. The
gateway owns request routing, authentication, provider schemas and storage.

## Session and transport contract

1. Authenticate the client and authorize the session before opening its map.
   Key map access on the verified principal and the server-owned conversation
   ID. Provider credentials authenticate the upstream call and confer no
   access to the map. Keep them separate from the prompt and reply buffers.
2. Sanitize before opening or writing to the provider. Keep required native and
   Secretlint credential scans active, and leave credential placeholders
   disabled. Use a per-session namespace, serialize map writes across requests
   for that session, and snapshot the committed map for each active reply. Keep
   it in private memory or private storage with a retention limit. Apply
   authorization before restoring even when the client knows the exact token.
3. Decode HTTP content encoding under separate wire and decompressed byte
   limits. Apply an upstream deadline and propagate disconnects. Strictly
   decode UTF-8, then parse complete JSON or bounded SSE frames. Transport
   fragments can cut a Unicode scalar, an escape, or the middle of a JSON
   frame. Provider deltas carry pieces of decoded fields and have their own
   boundaries.
4. For JSON, restore only allowlisted text fields and serialize the updated
   object to escape quotes, backslashes and newlines. For SSE, keep one
   independent cursor per logical text field. Key it on all relevant provider
   indices, such as response item, choice, content block, and tool call. Only
   put compatible deltas in the same cursor. Forward terminal events after
   flushing their fields, and reserialize edited events. Cap active cursors,
   frame size, and the total serialized output across cursors. Tool argument
   deltas require their own policy and grammar. For example, collect and parse
   a complete bounded argument value before restoring approved strings.
5. On a protocol error, over-limit response or disconnect, cancel open cursors
   and stop emitting events. Already delivered streaming output cannot be
   recalled. Buffer the complete bounded response before release if the
   application requires an indivisible reply decision.
6. Count input/output bytes, redactions, limit failures and durations.
   Log no prompts, credentials, maps, raw provider errors or restored text.
   Remove stale content lengths and encodings after rewriting. Scope caches to
   sanitized data or authenticated sessions.

In a reverse proxy, apply the contract between ingress authentication and the
provider request. For HTTPS CONNECT, a gateway must first terminate TLS in an
explicitly consented, locally configured inspection path with an allowlist.
An opaque CONNECT tunnel cannot inspect encrypted HTTP. Route unsupported or
opaque traffic according to the privacy policy, and refuse it when inspection
is required.

## Bounded cursor

`createStreamingRestorer(map, options)` snapshots an authorized map's canonical
values. It skips credential entries and ignores exact-document occurrences.
This is the derived-reply counterpart of whole-document `restore()`. The
cursor matches complete literal tokens in a single pass at Unicode boundaries.
Unknown tokens, unqualified token fragments, and truncated tokens at normal
EOF stay literal. Replacements are never fed back into the matcher.

```js
import { createStreamingRestorer } from '@link-foundation/sensitive-data-sanitizer';

const restorer = createStreamingRestorer(sessionMap);
const cursor = restorer.open({ signal });
const first = cursor.write('You mentioned Person-');
const second = cursor.write('1.');
const tail = cursor.finish();
// Write first + second + tail to the authorized reply field.
```

`open()` accepts strings and counts UTF-16 input units. Use
`open({ encoding: 'utf8', signal })` for a stream of Uint8Array chunks that
represents one plain text field. In UTF-8 mode the input units are bytes, with
strict decoding across chunk boundaries. Decode JSON or SSE framing before
using a text cursor for its individual fields.

| Option           | Default | Unit                                                |
| ---------------- | ------: | --------------------------------------------------- |
| `maxEntries`     |   4,096 | Map entries                                         |
| `maxMapUnits`    |   1 MiB | UTF-16 units of map tokens plus canonical originals |
| `maxChunkUnits`  |  64 KiB | UTF-16 code units or UTF-8 bytes per write          |
| `maxInputUnits`  |   1 MiB | UTF-16 code units or UTF-8 bytes across the cursor  |
| `maxOutputUnits` |   2 MiB | UTF-16 units emitted after restoration              |

The cursor retains only a possible token prefix, its boundary, and decoder
state between writes. An invalid chunk, invalid UTF-8, over-limit write or
aborted signal closes the cursor and throws a value-free error. Call `finish()`
once on normal EOF or `cancel()` when a stream is abandoned.

## Reverse proxy example

[The reply adapter](../examples/live-reply-adapter.mjs) takes principal identity
from the gateway's authentication layer. It serializes map updates and returns
a private snapshot per provider call. It implements the plain-text subset of
Chat Completions JSON and data-only SSE. Its input is raw HTTP body bytes after
transfer framing, with identity or gzip content encoding. It caps each wire and
decompressed body at 512 KiB, each SSE frame and request text at 64 KiB, and
each response at 16 choice indices. Its response closure belongs to the
authorized request that created it.

```js
import { createLiveReplySession } from '../examples/live-reply-adapter.mjs';
import { createPrivacyFilterDetector } from '../examples/local-model-spans.mjs';

// At authenticated session creation.
const session = createLiveReplySession(verifiedPrincipal);

// Within the authorized reverse proxy request handler.
const detector = createPrivacyFilterDetector({
  endpoint: 'http://127.0.0.1:18082/scan',
  signal: disconnectSignal,
});
const reply = await session.prepare(verifiedPrincipal, 'Alice Fiction', {
  detector,
  signal: disconnectSignal,
});
recordRedactionCount(reply.redactions);
// Put reply.providerText into the selected provider message field.
// Feed reply.json(...) or reply.sse(...) the provider's raw body.
```

With Fetch, responses are already decompressed. Supply decoded bytes with
identity encoding, and use the raw HTTP client or another transport with
decompression disabled where both wire and decoded byte limits are needed.
The example tests exercise synthetic text, split gzip bytes, interleaved
deltas, disconnection and independently authenticated sessions.

## Optional loopback semantic detection

[The detector examples](../examples/local-model-spans.mjs) work with
`createSanitizer({ detectors: [detector] })`. Both send input to an explicitly
configured loopback server on `127.0.0.1` or `[::1]`; redirects are rejected.
Deploy the model locally and keep body logging disabled. The ordinary scan
path remains offline when these examples are unused.

- `createPrivacyFilterDetector({ endpoint })` sends `{text}` and reads the
  typed OpenAI Privacy Filter schema v1 from a local wrapper. Use the typed result of
  `OPF().redact(text).to_dict()` from the local Python API inside that wrapper. The wrapper must pass through the input echo,
  summary and typed spans unchanged. Offsets are zero-based Python Unicode
  code points and the end is exclusive. The stock report has no model score.
  If the wrapper provides span confidence, it must be finite in [0, 1]. Setting
  `minConfidence` requires scored spans. The core may attach its normal default
  finding confidence to scoreless findings.
- `createLocalModelDetector({ endpoint, model, mode })` sends a non-streaming
  OpenAI-compatible Chat Completions request. The model must support JSON mode
  and return one complete choice with `finish_reason: "stop"`. Its message
  contains a JSON object with `unit: "byte"` and a `spans` array. Each span
  includes `start`, exclusive `end`, `label`, exact source `text`, and a
  finite `confidence` in [0, 1]. Hybrid mode adds model personal findings at
  0.7 or greater. Verify mode requires higher model evidence (0.9 by default).
  Both keep the same deterministic credential union. A valid model secret span
  adds a credential finding regardless of its score. Exact-span checks catch
  coordinate and text errors. Recall depends on the local model.

Both normalize to JavaScript offsets and validate the full report before
returning any findings. They allow the eight stock Privacy Filter labels and
discard quotes and provider data before returning findings. Defaults cap input
at 8 KiB UTF-8, response at 256 KiB, spans at 512, and each call at 3 seconds
including body read. Pass a request-level abort signal to apply a deadline
across every invocation, since the async engine may scan normalized, decoded or
residual views too.

For an indivisible request decision, keep the default `failurePolicy: 'block'`.
If any required detector fails, the sanitizer rejects and the proxy must send
nothing to the provider. The explicit `deterministic-only` fallback discards the
entire failed model report and continues native and Secretlint scanning. Use it
only where deterministic coverage is acceptable. It still propagates caller
cancellation. Keep `knownOnly` disabled and leave `secretlint` enabled to retain
the full deterministic union. The [mock endpoints](../tests/sanitizer-local-model.test.js)
use synthetic values and run without model weights or provider accounts.
