# Library and detector contract

Import the ESM root entry; complete declarations are in `src/index.d.ts`. Inputs are strings, offsets are UTF-16 code units, starts are zero-based, and ends are exclusive. Returned line and column numbers are one-based; columns also count UTF-16 units.

## Methods

| Method                                 | Behavior                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `createSanitizer(options)`             | Asynchronous native + required Secretlint + selected detector union                                          |
| `engine.inspect(text)`                 | Detect, validate, deduplicate, apply public policy, and return metadata                                      |
| `engine.sanitize(text)`                | Detect, union overlapping spans, mask completely, verify every engine, return `{text, findings, redactions}` |
| `inspect(text, options)`               | Synchronous native detection and caller findings                                                             |
| `sanitize(text, options)`              | Synchronous native redaction and native residual verification                                                |
| `redact(text, findings, options)`      | Apply validated ranges without automatic detection/verification                                              |
| `auditGitHistory(repository, options)` | Read-only audit of local reachable text objects                                                              |

`redactions` counts merged replacement spans. `findings` can contain several detector hits for one replacement. Findings have `{start, end, type, category, rule, line, column}`; no text, quote, match, entropy score, provider details, or raw diagnostic is copied. Debugging is off by default; `debug(event)` receives only `{event: 'detected', count}`.

## Options

| Option           | Default / meaning                                                                 |
| ---------------- | --------------------------------------------------------------------------------- |
| `knownSecrets`   | `[]`; exact literal credential values, regardless of length or format             |
| `knownPersonal`  | `[]`; `{type, value}` literals with Unicode case-insensitive matching             |
| `publicEntities` | `[]`; exact PERSON/ORGANIZATION/EMAIL exception with HTTPS source and review date |
| `findings`       | `[]`; validated detections for the original input, supplied by the caller         |
| `detectors`      | `[]`; additional required callbacks in the asynchronous engine                    |
| `secretlint`     | `true` in the asynchronous engine                                                 |
| `decode`         | `true`; bounded base64/base64url, hex and percent decoding                        |
| `paranoid`       | `false`; entropy-based supplemental credential heuristic                          |
| `maxInputLength` | 10,485,760 UTF-16 units                                                           |
| `maxFindings`    | 100,000 detector hits before deduplication                                        |
| `debug`          | Optional trusted callback for counts only                                         |

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
