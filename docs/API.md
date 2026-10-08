# Library and detector contract

Import the ESM root entry; complete declarations are in `src/index.d.ts`. Inputs are strings, offsets are UTF-16 code units, starts are zero-based, and ends are exclusive. Returned line and column numbers are one-based; columns also count UTF-16 units.

## Methods

| Method                                 | Behavior                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `createSanitizer(options)`             | Asynchronous native + required Secretlint + selected detector union                                          |
| `engine.inspect(text)`                 | Detect, validate, deduplicate, apply public policy, and return metadata                                      |
| `engine.sanitize(text)`                | Detect, union overlapping spans, mask completely, verify every engine, return `{text, findings, redactions}` |
| `engine.sanitizeJsonl(text)`           | Batched structured JSONL sanitization using the same options and required engines                            |
| `inspect(text, options)`               | Synchronous native detection and caller findings                                                             |
| `sanitize(text, options)`              | Synchronous native redaction and native residual verification                                                |
| `redact(text, findings, options)`      | Apply validated ranges without automatic detection/verification                                              |
| `auditGitHistory(repository, options)` | Read-only audit of local reachable text objects                                                              |

`redactions` counts merged replacement spans. `findings` can contain several detector hits for one replacement. Findings have `{start, end, type, category, rule, line, column}`; no text, quote, match, entropy score, provider details, or raw diagnostic is copied. Debugging is off by default; `debug(event)` receives only `{event: 'detected', count}`.

## Options

| Option             | Default / meaning                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `knownSecrets`     | `[]`; exact literal credential values, regardless of length or format                         |
| `knownPersonal`    | `[]`; `{type, value}` literals with Unicode case-insensitive matching                         |
| `publicEntities`   | `[]`; exact PERSON/ORGANIZATION/EMAIL exception with HTTPS source and review date             |
| `findings`         | `[]`; validated detections for the original input, supplied by the caller                     |
| `detectors`        | `[]`; additional required callbacks in the asynchronous engine                                |
| `secretlint`       | `true` in the asynchronous engine                                                             |
| `decode`           | `true`; bounded base64/base64url, hex and percent decoding                                    |
| `paranoid`         | `false`; entropy-based supplemental credential heuristic                                      |
| `maxInputLength`   | 10,485,760 UTF-16 units                                                                       |
| `maxFindings`      | 100,000 detector hits before deduplication                                                    |
| `debug`            | Optional trusted callback for counts only                                                     |
| `identityMask`     | `false`; identity types keep 2+2 Unicode characters with fixed `***`, or redact below five    |
| `fakeIdentity`     | Off; `'specimen-and-synthetic'` retains explicitly fake identity values                       |
| `fakeValues`       | `[]`; exact caller-reviewed identity values to retain, regardless of fakeIdentity             |
| `structured`       | Off; `'json'` or `'jsonl'` validates and sanitizes string keys/values separately              |
| `structuralFields` | `[]`; declared property names suppress weak name/ID/entropy heuristics in their string values |

Unknown options and invalid limits are errors. `knownSecretsFromEnv(env, names)` explicitly selects common credential variables, deduplicating nonempty values. It never invokes shell commands or reads auth files. `personalVariants(entries)` generates numeric and ISO/day-first date spellings; name case variants are already handled by detection. Neither helper invents transliterations.

## Required detectors

A detector supplies `detect(text)`, returning an array of `{start, end, type, category, rule}` or a Promise of that array. Every range must refer to the exact input passed to that invocation. `category` is `credential` or `personal`; types are uppercase identifiers, rules are bounded lowercase identifiers. Throw if analysis is incomplete. The framework invokes engines on original input, normalized input when changed, bounded decoded views, and finally the sanitized output. Decoded matches redact the entire original encoded run. Malformed findings and engine errors block publication with generic error codes.

Callbacks, policies, binaries, model packages, and their rule identifiers are trusted code/configuration. A malicious adapter can omit findings, leak input through its own logging/network calls, or never resolve. Local subprocess helpers use 30-second termination and 10 MiB output caps; arbitrary callback time budgets belong to the embedding application. Pin binary/model versions in deployments. Do not convert a failed scan into an empty result.

## Report adapters

- `fromGitleaks(text, report)` matches every literal `Secret` occurrence and supported decoded representations.
- `fromTrufflehog(text, report)` maps `Raw`/`RawV2` to every literal or bounded decoded occurrence. Unmapped raw values are errors.
- `fromDetectSecrets(text, baseline, filename)` redacts each flagged complete line because hashed baselines contain no recoverable secret span.
- `fromPresidio(text, results)` converts Python Unicode codepoint ranges, mapping standard PII types and credential passwords.
- `fromOffsetReport(text, entries, {unit, rule})` accepts explicitly declared `utf16`, `codepoint`, or UTF-8 `byte` ranges. Entries supply category/type. Unknown units and partial UTF-8 character boundaries fail.

`codePointRange()` and `byteRange()` expose the same conversions. Extra provider fields are discarded. Reject incomplete/paginated/truncated reports in the caller before adaptation.

For [Google findings](https://docs.cloud.google.com/java/docs/reference/google-cloud-dlp/latest/com.google.privacy.dlp.v2.Location), convert `location.byteRange` numeric strings to numbers and use `unit: 'byte'`; map infoTypes to appropriate category/type. Use only a report for the exact single text item, not offsets relative to a table cell. For [Azure](https://learn.microsoft.com/en-us/rest/api/language/analyze-text/analyze-text/analyze-text?view=rest-language-analyze-text-2026-05-01), request `stringIndexType: 'Utf16CodeUnit'` and use `offset` through `offset + length` with `unit: 'utf16'`. AWS's [PII entity documentation](https://docs.aws.amazon.com/comprehend/latest/APIReference/API_PiiEntity.html) describes character offsets; establish non-ASCII/end-boundary behavior for the SDK/report version before choosing an explicit unit. There is no guessed cloud offset default.

The native package does not send text to these services. An application that chooses remote detection controls its own consent, regions, credentials, and retention.

## Transformations and confidence

Findings also carry `confidence` (0–1) and `likelihood` (`VERY_UNLIKELY` through `VERY_LIKELY`). Native scores describe rule strength; they are not probabilities calibrated across engines. External detectors can supply their own validated scores.

Full redaction remains the default. `transformation` selects a global mode; `transformations` maps finding types to overrides. Credentials always receive full redaction except when the caller explicitly chooses `hive-mask`:

| Mode                | Configuration and behavior                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `redact`            | Complete `[REDACTED]` replacement                                                                                      |
| `hive-mask`         | First/last three Unicode characters with `…` for values longer than 12; shorter values remain opaque                   |
| `mask`              | Personal data only; `keepStart`/`keepEnd` reveal a bounded prefix/suffix and mask the rest                             |
| `pseudonym`         | Personal data only; keyed HMAC-SHA256, type-separated deterministic opaque identifier                                  |
| `format-preserving` | Personal data only; keyed deterministic character-class pseudonym, preserving punctuation and ASCII letter/digit shape |
| `date-shift`        | Personal ISO dates; finite integer `days`, UTC calendar arithmetic; invalid dates become opaque                        |
| `bucket`            | Personal safe integers; positive integer `size`, inclusive numeric interval                                            |

Both keyed modes require a key of at least 16 UTF-8 bytes. `format-preserving` is a non-reversible shape pseudonym, not NIST FF1 encryption; it does not preserve checksum validity, country-specific alphabets or guarantee uniqueness. Partial masks, date shifts and buckets intentionally retain information. Keep pseudonym keys outside logs. Residual verification checks the corresponding fully redacted representation; opted-in disclosures can remain recognizable in the transformed output. Use default redaction for publication that requires opaque output.

`preserveEncoding: true` sanitizes decoded payloads with the same required engine union, re-encodes them and verifies decoding reproduces the sanitized content. Supported formats include base64/base64url, hex, percent, numeric HTML and UTF-8 byte escapes. Escaped JSON string content is sanitized and re-encoded even under default redaction so nested session JSON stays parseable. Malformed or unsupported encodings block opted-in preservation. Known encoding candidates and nesting are bounded.

## Identity policy and structured sessions

`identityMask: true` applies `{mode: 'mask', keepStart: 2, keepEnd: 2,
marker: '***', minLength: 5}` to document/travel/national-ID types, including
catalog passport types. Explicit per-type/global transformations take precedence.
`mask.marker` is an optional fixed string; omitting it preserves length-based
asterisks. `mask.minLength` defaults to five for identity types and zero for other
types. Length and retained boundaries count Unicode characters.

`fakeIdentity: 'specimen-and-synthetic'` recognizes ICAO Utopia/Eriksson specimens,
national specimen markers, repeated document digits and at least six consecutive
ascending/descending document digits. `fakeValues` supplies exact reviewed
identity values independently of that option. Kept findings carry `kept: 'fake'`
and do not count as redactions. The same value check applies during verification.
Words such as test/example/fake do not grant exemptions. Credentials from any
engine and overlapping known secrets always win. Both policies are opt-in.

```js
const sessionSanitizer = createSanitizer({
  structured: 'jsonl',
  structuralFields: ['id', 'type', 'name', 'description'],
});
const result = await sessionSanitizer.sanitizeJsonl(sessionText);
```

Structured mode scans string keys and values in bounded batches, supplies field
context, retains original source offsets/formatting, and verifies parseable
output. Numbers, booleans and null remain their original types. Declarations
apply to property names at every nesting level, including string array elements
inside that property. Declare only fields your application treats as metadata:
`name` may also contain a person's name. Known private values, explicit provider
credentials, password/auth context, document formats and other strong findings
remain protected in declared fields. Custom required detectors still run.
Escaped nested JSON retains encoding. Invalid JSON and key collisions block
publication with `ERR_JSON` / `ERR_JSON_COLLISION`.

Oversized encoded runs receive a conservative complete-run `ENCODED_LIMIT`
redaction rather than aborting the record. Decoding probes are capped at 4,096
characters; full decoding stays capped at 8,192 characters. Whole-input,
candidate-count, record and worker limits still apply. This fallback can remove
large non-sensitive encoded outputs; its finding makes that decision auditable.

## Streaming and worker publication

`sanitizeStream(source, options)` accepts iterable UTF-8 bytes/strings and yields sanitized records. It holds incomplete lines, quoted multiline values, PEM/PuTTY blocks, netrc triplets and wrapped base64 groups across chunks. Defaults: 1 MiB held record, 256 KiB batch and 1 GiB total input. A record exceeding `maxRecordBytes` fails; raising the total limit does not raise the record limit. The generator may have yielded earlier verified records when a later record fails. Use `sanitizeStreamToFile` for atomic publication of the whole stream.

`sanitizeFileToFile` rejects source symlinks and writes private temporary output, publishing only after complete verification. `sanitizeFileBounded` additionally uses a worker with a 256 MiB old-generation heap, 4 MiB stack and 60-second deadline; `workerHeapMb` and `workerTimeoutMs` are configurable. Worker failure removes its private staging directory before returning. Limits bound package work, not arbitrary external detectors. Callbacks supplied through `sanitizer` run in process; set `worker: false` explicitly to disable isolation. Pass serializable options through `sanitizerOptions` for workers. Memory limits do not include all native/WASM allocation.

```js
import { sanitizeFileBounded } from '@link-foundation/sensitive-data-sanitizer';
await sanitizeFileBounded('session.jsonl', 'session.safe.jsonl', {
  maxTotalBytes: 1024 * 1024 * 1024,
  maxRecordBytes: 1024 * 1024,
});
```

The CLI supports `redact FILE --stream --output NEWFILE` and stdin streaming. Stdout uses a private spool and receives nothing until the entire scan succeeds. `--max-record-bytes` controls held records; `--max-bytes` defaults to 1 GiB with `--stream`. `--json` / `--jsonl`, `--identity-mask`, `--hive-mask`, `--preserve-encoding` and `--gh-auth` are explicit opt-ins.

## Public verification and publication helpers

Built-in Wikidata names/organizations, resolver/documentation IPs and role emails on known organization domains are enabled by default; `publicKnowledge: false` disables those heuristics. `knownPersonal` forces private treatment. `publicEntities` remains an audited exact override; credentials always outrank exemptions.

`createWikidataVerifier(options)` provides optional asynchronous `verifyPublic`; the CLI enables it only with `--verify-public`. It sends eligible PERSON/ORGANIZATION names to Wikidata, requires an exact label and a public-role description, caches bounded results, and blocks output on network failure. Name collisions remain possible: this is a public-name heuristic, not proof of a person's identity. Explicit private literals and sensitive relationship contexts prevent automatic exemptions. Offline mode makes no network requests.

`knownSecretsFromGitHubAuth({command, hostname, timeoutMs})` explicitly invokes local `gh auth token` and returns its nonempty exact value without diagnostics. It is never called automatically; failed authentication blocks opted-in scans. `knownSecretsFromEnv` remains separate and reads only explicitly selected environment variables.

`sanitizePayload(payload, {sanitizer})` sanitizes JSON payload values with the required union while retaining JSON structure. `createSentryBeforeSend(options)` returns a Sentry hook that drops the event (`null`) if sanitization fails. `createOutboundSanitizer(send, options)` calls the supplied transport only after successful sanitization. These helpers do not send data themselves.

The optional ESLint plugin exports `require-sanitized-output` from the package's `eslint-plugin` subpath. It checks configured outbound sinks and common GitHub CLI body/title arguments, including `--body-file`, templates and argv arrays. Configure `sinks` and `sanitizers` for your application. It is a conservative syntactic aid, not a complete data-flow proof; runtime verification remains required.

## Native documented entity catalogs

`entityCatalogs` exposes source URLs, source-page SHA256 and documented names for Google (213), Azure (176) and AWS (36). Their canonical uppercase underscore labels are recognized natively, with complete value spans, independent of cloud services. The package also implements selected automatic formats and checksum algorithms. Catalog vocabulary support does not reproduce proprietary NER, image/document inspection, regional identity validators, cloud risk analysis or their accuracy. See the coverage table for that distinction.
