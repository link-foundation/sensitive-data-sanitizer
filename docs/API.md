# Library and detector contract

Import the root entry with `import` or `require`; complete declarations are in `src/index.d.ts`. Inputs are strings, offsets are UTF-16 code units, starts are zero-based, and ends are exclusive. Returned line and column numbers are one-based; columns also count UTF-16 units.

## Methods

| Method                                 | Behavior                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `createSanitizer(options)`             | Asynchronous native + required Secretlint + selected detector union                                          |
| `engine.inspect(text)`                 | Detect, validate, deduplicate, apply public policy, and return metadata                                      |
| `engine.sanitize(text)`                | Detect, union overlapping spans, mask completely, verify every engine, return `{text, findings, redactions}` |
| `engine.sanitizeJsonl(text)`           | Batched structured JSONL sanitization using the same options and required engines                            |
| `inspect(text, options)`               | Synchronous native + array-returning detectors and caller findings                                           |
| `sanitize(text, options)`              | Synchronous native + array-returning detectors and residual verification                                     |
| `redact(text, findings, options)`      | Apply validated ranges without automatic detection/verification                                              |
| `createSyncSanitizer(options)`         | Reusable synchronous `inspect` / `sanitize` with the same policies                                           |
| `compileKnown(...lists)`               | Copy, freeze, merge and precompile caller-known personal values                                              |
| `auditGitHistory(repository, options)` | Read-only audit of local reachable text objects                                                              |
| `decrypt(text, key, options)`          | Restore values from `[ENCRYPTED:TYPE:…]` tokens written by the `encrypt` transformation                      |
| `createPatternDetector(specs, opts)`   | Declarative regex, deny-list, hotword and validator detector                                                 |
| `createIdentifierDetector(rules)`      | Detector for caller-supplied national identifier rules (`nationalRules` shape)                               |
| `toSarif(report, options)`             | Convert a scan report or findings to SARIF 2.1.0 without values                                              |

`redactions` counts merged replacement spans. `findings` can contain several detector hits for one replacement. Findings have `{start, end, type, category, rule, line, column}`; no text, quote, match, entropy score, provider details, or raw diagnostic is copied. The optional `strict-attributes` debug event reports only detected and suppressed match counts. Debugging is off by default; `debug(event)` receives value-free counts, rule timings, residual rounds and registry event metadata (see `DebugEvent` in the TypeScript declarations).

### Credentials-only entry

`@link-foundation/sensitive-data-sanitizer/credentials` exports `inspect`,
`sanitize`, `redact`, `createSanitizer`, `createSyncSanitizer`, `REDACTED`,
`entropy`, `builtInRules`, `tokenChecksum`, `tokenWithChecksum` and the
`knownSecretsFrom*` helpers. It always runs with `credentialsOnly: true` and
does not load the personal-data detectors, faker or libphonenumber, so it starts
about three times faster than the root entry (about 0.25 s against 0.75 s on
Node.js 26). Use it for loggers that must mask every line from the first write:

```js
const {
  createSyncSanitizer,
  knownSecretsFromEnv,
} = require('@link-foundation/sensitive-data-sanitizer/credentials');
const mask = createSyncSanitizer({ knownSecrets: knownSecretsFromEnv() });
console.log(mask.sanitize('Authorization: Bearer abc123def456ghi789').text);
// Authorization: Bearer [REDACTED]
```

Options that need the personal-data modules, `credentialsOnly: false`,
`mode: 'fake'` and `properNames`, fail with `ERR_CONFIG`. Known personal values
(`knownPersonal`) still work. Both entries offer `import`, `require` (Node.js
22.12 or later) and `default` export conditions.

## Options

### Replace only known values

Use `knownOnly: true` to preserve fictional examples while replacing selected
private values. This applies to sync/async, JSON/JSONL, streams and fake mode.
It skips automatic credential detection too; supply `knownSecrets` explicitly
for credentials that must be removed. `credentialsOnly` can further exclude
personal values. CLI: `--known-only` with a `--config` containing the known lists.

```js
const result = sanitize('Анна Смирнова; example Jane Doe', {
  knownOnly: true,
  knownPersonal: [{ type: 'PERSON', value: 'Анна Смирнова' }],
  transformation: { mode: 'placeholder' },
});
// result.text: 'Person-1; example Jane Doe'
restore(result.text, result.map); // exact original
```

### Reversible placeholders

`transformation: {mode: 'placeholder'}` emits typed tokens such as `Person-1`,
`Email-1`, `Phone-1`, `Organization-1`, `Education-1`, `Location-1` and `Date-1`.
Numbers start at one per type and follow the first occurrence in the input.
`DATE_OF_BIRTH` uses the `Date` label; other detector types retain their type
name in title case. Per-type `transformations` also support placeholder mode;
all placeholder transformations in an operation must share one map and format.

The result has a private `map` alongside `text`, `findings` and `redactions`.
The map holds token entries, every original surface form, name aliases, and
replacement positions indexed by the SHA-256 digest of the sanitized document.
It does not store the original full document. `restore(text, map)` restores
the exact bytes represented by the original JavaScript string, including JSON
escaping and whitespace, when the document digest matches. A derived response
that quotes tokens uses the entry's canonical original spelling instead.
Restoration uses a single pass so restored originals are never interpreted as
more tokens. Unknown tokens and larger words containing token-like fragments
are left alone.

`format` is a template with exactly one type field (`{Type}`, `{TYPE}` or
`{type}`) and one `{n}` field. Examples: `{Type}-{n}`, `[{TYPE}_{n}]`,
`{{{type}_{n}}}`. Sanitization refuses input containing any token in the chosen
namespace for built-in and supplied type labels, including numbers not allocated yet.
Unicode letters, marks, digits and underscores bound those tokens. Ordinary
technical names such as GPT-4, ISO-9001 and Windows-10 are not reserved. The map's format cannot change
on reuse. A malformed map or ambiguous exact restoration blocks output.

`createRestoreMap({format?})` creates an empty reusable map. Pass a map as
`transformation.map` to continue a corpus; the operation updates that same
object. A `createSanitizer()` engine also keeps its registry across calls.
Callers must serialize access to a shared engine/map; parallel independent
registries cannot assign consistent first-appearance numbers. For streams,
pass an explicit map object and keep it outside the output stream. Placeholder
JSONL uses the coordinator in source order, even if several workers were
requested. File APIs also keep this registry in the caller process.

`serializeRestoreMap(map, 'json' | 'lino')` and `parseRestoreMap(text)` round
trip the same schema. Lino uses the upstream `links-notation` parser and
formatter: a named `sensitive-data-restore-map` link carries the escaped JSON
schema as a reference, preserving all metadata and unusual original strings.
`readRestoreMap(path)` and `writeRestoreMap(path, map, {format?, replace?})`
use bounded file reads and the existing atomic `0600` writer. The default
serialization is JSON, or Lino for a `.lino` output path. Existing files require
`replace: true`; symlinks are refused. `inspect`, `sanitize`, scanner union and
CLI publication paths reject marked map content with `ERR_PRIVATE_MAP`.
Keep maps out of Git, logs, model requests and publication directories. The map
is plaintext personal data, not encrypted storage; protect it as the original.

`credentials: true` explicitly opts credentials into `Credential-n` entries.
Otherwise they remain `[REDACTED]` and cannot be recovered, including through
occurrence metadata. Placeholder results include `irreversibleRedactions`, the
number of replacements excluded from the restore map (including mixed policies).
Check that this is zero before relying on exact restoration. A positive count
means `restore()` cannot reconstruct all of the input. `map: false` returns only the anonymized text and ordinary
value-free finding metadata. The temporary numbering registry is discarded
after an operation (or the complete stream); no map file is created. Residual verification
still runs, including every required engine for `createSanitizer`.

Name components, unique initial-plus-surname forms, existing transliteration
aliases and selected Russian `-ов`/`-ев` inflections share an entity token.
Explicit `knownPersonal` and reused map entries also match bounded Russian noun,
adjective, feminine surname and given-name case endings, two-part person names
in reverse order, and organization cores without legal forms/quotes. Inflected
forms consume whole Unicode words; minimum stem lengths limit overmatching.
This is conservative heuristic identity linking, not general coreference:
ambiguous surnames/initials and unrelated people are not intentionally merged.

A PERSON entry of a reused map matches the same forms as an explicit
`knownPersonal` value: the full value and its contiguous parts together, all
cases, both orders and initials. A bare part does not match in the next document
unless it is stored as its own value, so `Петров Данил` from one CV leaves
`петров день` and `Петров пришёл.` in the next one untouched. A single stored word
(`Мороз`) matches its capitalized and upper-case forms but not lower-case text
(`сильный мороз`); a multi-word value also matches in lower case (`петров данил`).
A part listed in `knownPersonal` is kept in the entry's `standalone` list once it
has been replaced, and bare surfaces recorded by earlier versions are ignored on
reuse. The evidence of the current document is separate: when its text names
`Петров Данил`, a bare `Петров` or `петрову` in that document, including its stream
batches and decoded values, links to that person exactly as with a fresh map.

When a bare part matches, the span in placeholder mode takes the capitalized
given name or patronymic next to it on the same line, so `Алина Мороз` becomes one
new token instead of `Алина Person-1`. Given names come from a bounded list with
Russian case endings, so an unlisted name can still stay beside the placeholder.

A listed Russian PERSON value also matches all six grammatical cases, including
the instrumental (`Петровым Данилом Сергеевичем`), every word order, `ё`/`е`
spelling differences in either direction, upper case, and initials with or
without spaces in both positions and all cases (`Петрову Д. С.`, `Д.С. Петрова`).
The contiguous name parts of a listed three-part name match together
(`Петров Данил`, `Данил Сергеевич`, `с Петровым Данилом`). A part on its own does
not: a bare `Данил` or `Сергеевич` is too ambiguous to imply from a longer value,
so list each part you want matched alone as its own `knownPersonal` entry. Listing
parts next to the full name keeps one token and one fake identity.
Every replaced occurrence retains its exact original surface privately. With
one identical token, a derived answer cannot encode the original grammatical
case; it receives the canonical spelling. Two distinct originals that produce
the same entire sanitized document cannot both be distinguished by that text
and a shared map; such conflicting occurrence metadata is refused. Choose
separate maps for those documents if exact independent restoration is needed.

JSON/JSONL keys and values participate equally in placeholder mode, including
ordinary identifier keys and declared structural fields. With `properNames`,
JSON keys remain unchanged by automatic personal detection in all transformation
modes. Explicit known values and credentials retain priority. Parseability and
duplicate-key checks remain enforced. Plain redact/fake policies retain their
existing metadata/key behavior. Use `structured` for valid structured input.
The normal encoding limits and credential redaction policy continue to apply.

CLI: `redact FILE --placeholder --map private.json` creates or continues a map;
`--no-map` explicitly discards it. A CLI placeholder operation requires one of
these choices, to avoid losing a map silently. `--placeholder-format`,
`--map-format json|lino` and `--map-credentials` configure the transformation.
`restore safe.txt --map private.lino [--output restored.txt]` also works on a
derived model answer. Input, output and map paths must be separate. Maps are
saved separately before stdout publication. `--profile documents` enables the
new document recognizers; `documentEntities: false` turns them off explicitly.

| Option                   | Default / meaning                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `documentEntities`       | Off; bounded organization, education and location rules; enabled by the documents profile                                                                        |
| `properNames`            | Off; `'capitalized'` enables structural name redaction in activated prose strings                                                                                |
| `scripts`                | `['Cyrillic']`; Unicode Script aliases that activate the prose rule; `[]` disables only script activation                                                        |
| `profile`                | Off; `'publication'` sets a 0.3 threshold and identity masking; `'documents'` enables document entities                                                          |
| `knownOnly`              | `false`; disable all automatic detection (including credentials, Secretlint and custom detectors); use explicit findings, known values and reused map identities |
| `knownSecrets`           | `[]`; exact literal credential values, regardless of length or format, plus their standalone hex (either case) and base64/base64url spellings                    |
| `knownPersonal`          | `[]`; `{type, value}` values with whole-word Unicode case-insensitive matching and bounded Russian forms; list parts to match them alone                         |
| `publicEntities`         | `[]`; exact PERSON/ORGANIZATION/EDUCATION/LOCATION/EMAIL exception with HTTPS evidence and review date                                                           |
| `findings`               | `[]`; validated detections for the original input, supplied by the caller                                                                                        |
| `detectors`              | `[]`; required callbacks in both engines; sync methods require arrays                                                                                            |
| `secretlint`             | `true` in the asynchronous engine                                                                                                                                |
| `decode`                 | `true`; bounded base64/base64url, hex and percent decoding                                                                                                       |
| `paranoid`               | `false`; entropy-based supplemental credential heuristic                                                                                                         |
| `maxInputLength`         | 33,554,432 UTF-16 units                                                                                                                                          |
| `maxFindings`            | 100,000 detector hits before deduplication                                                                                                                       |
| `minConfidence`          | 0.5; personal findings below this score remain visible to inspect but are not replaced                                                                           |
| `threshold`              | Alias for minConfidence; both options must agree when supplied                                                                                                   |
| `debug`                  | Optional trusted callback for value-free counts, timing and event metadata                                                                                       |
| `identityMask`           | `false`; identity types keep 2+2 Unicode characters with fixed `***`, or redact below five                                                                       |
| `fakeIdentity`           | Off; `'specimen-and-synthetic'` retains explicitly fake identity values                                                                                          |
| `fakeValues`             | `[]`; exact caller-reviewed identity values to retain, regardless of fakeIdentity                                                                                |
| `structured`             | Off; `'json'` or `'jsonl'` validates and sanitizes string keys/values separately                                                                                 |
| `sensitiveFields`        | `[]`; JSON/JSONL names normalized for case and `_`/`-`; complete values become a redaction string; supports synchronous calls                                    |
| `exactFields`            | `false`; sensitive/allowed selectors use exact case/punctuation when true                                                                                        |
| `allowedFields`          | Off; redact unlisted JSON/JSONL string leaves, scan listed leaves normally                                                                                       |
| `rules` / `types`        | Per-rule / per-type booleans for automatic built-in findings                                                                                                     |
| `fields`                 | `{location: 'scan'}` skips whole-field inference and still scans content                                                                                         |
| `allowCredentialDisable` | `false`; explicit permission required to suppress credential rules/types                                                                                         |
| `vocabulary`             | Optional additive document cue lists; see below                                                                                                                  |
| `strict`                 | `false`; aggressive stored-log personal attributes and bare values                                                                                               |
| `structuralFields`       | `[]`; declared property names suppress weak name/ID/entropy heuristics in their string values                                                                    |

Unknown options and invalid limits are errors. `knownSecretsFromEnv(env, names?, {minLength?})` discovers credential-named variables (excluding configuration names) when names are omitted, or uses an explicit selection, deduplicating nonempty values (or values of at least `minLength` characters). It never invokes shell commands or reads auth files. `personalVariants(entries)` generates numeric and ISO/day-first date spellings; name case variants are already handled by detection. Neither helper invents transliterations.

## Required detectors

A detector supplies `detect(text)`, returning an array of `{start, end, type, category, rule}` or, in `createSanitizer`, a Promise of that array. Sync `inspect`, `sanitize` and `createSyncSanitizer` require an array; returning a thenable throws `ERR_CONFIG` (its rejection is observed). Every range must refer to the exact input passed to that invocation. `category` is `credential` or `personal`; types are uppercase identifiers, rules are bounded lowercase identifiers. Throw if analysis is incomplete. The framework invokes engines on original input, normalized input when changed, bounded decoded views, and finally the sanitized output. Structured callbacks receive each decoded string separately, including escaped Unicode and nested serialized strings, with mapped original offsets. Decoded matches redact the entire original encoded run. Malformed findings and engine errors block publication with generic error codes.

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

Bare checksum coincidences generally score 0.35. Identity labels raise confidence; specific national structures can supply stronger evidence independently. Timestamp/elapsed metadata and plausible epoch numbers are negative evidence. `minConfidence` defaults to 0.5, applies to personal findings in every detection/rendering/verification path, and never weakens credential protection. Set it to 0.3 to replace bare checksum matches. Generic calendar dates remain unchanged unless personal/birth context identifies them.

`profile: 'publication'` sets `minConfidence: 0.3`, `identityMask: true` and
`fakeIdentity: false` unless explicitly overridden. It retains required engines,
decoding, input limits and full-redaction residual verification. Both synchronous
and async APIs accept it; CLI `redact` uses it by default. Set `identityMask: false`
for complete identity replacement. A supplied `threshold` is honored, and
conflicting threshold aliases still fail configuration validation. Formatted
checksum-valid SNILS and 12-digit personal INN score 0.99 even without this
profile; bare 10-digit organizational INN remains 0.35. See the effective
[national-ID defaults](COVERAGE.md#national-id-defaults).

Without a profile, full redaction is the library default. `transformation` selects a global mode; `transformations` maps finding types to overrides. Credentials receive full redaction except for explicit `hive-mask` or `fake` with `credentials: true`:

| Mode                | Configuration and behavior                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `redact`            | Complete `[REDACTED]` replacement                                                                                      |
| `hive-mask`         | First/last three Unicode characters with `…` for values longer than 12; shorter values remain opaque                   |
| `mask`              | Personal data only; `keepStart`/`keepEnd` reveal a bounded prefix/suffix and mask the rest                             |
| `pseudonym`         | Personal data only; keyed HMAC-SHA256, type-separated deterministic opaque identifier                                  |
| `format-preserving` | Personal data only; keyed deterministic character-class pseudonym, preserving punctuation and ASCII letter/digit shape |
| `fake`              | Keyed realistic names, valid dates/MRZ/checksummed numbers and reserved contact destinations                           |
| `date-shift`        | Personal ISO dates; finite integer `days`, UTC calendar arithmetic; invalid dates become opaque                        |
| `bucket`            | Personal safe integers; positive integer `size`, inclusive numeric interval                                            |
| `encrypt`           | Personal data only; deterministic AES-256-GCM token reversible with `decrypt` and the key (see below)                  |

All keyed modes require a key of at least 16 UTF-8 bytes. `format-preserving` is a non-reversible shape pseudonym, not NIST FF1 encryption; it does not preserve checksum validity, country-specific alphabets or guarantee uniqueness. Partial masks, date shifts and buckets intentionally retain information. Keep pseudonym keys outside logs. Residual verification checks the corresponding fully redacted representation; opted-in disclosures can remain recognizable in the transformed output. Use default redaction for publication that requires opaque output.

`{mode: 'fake', key}` infers name locale, script and gender from the supported gazetteer/datasets and recognizable surname/patronymic endings. Independent HMAC-seeded Faker instances make results independent of processing order. Russian Cyrillic/transliterated spelling, name order and filename separators share component identities. Ambiguous names can use a fallback locale; this is not universal name/gender inference. Dates use one keyed backward offset of 1–365 days and preserve ISO, slash and dot formats. Complete TD1/TD2/TD3 MRZs regenerate individual/composite checks and match separately faked name/date fields. Issuer/nationality remain original unless `mrzCountry: 'UTO'` is supplied. Unsupported/damaged formats fall back to full redaction.

Russian mentions of one person, organization, school or location share one fake identity. The fake follows the source word order, initials, capitalization, grammatical case and, for people, sex: `Петров пришёл. Позвонили Петрову. С Петровым.` becomes `Баранов пришёл. Позвонили Баранову. С Барановым.`, and `ООО «Ромашка» … в Ромашке` becomes `ООО «Импульс» … в Импульсе`. Declension uses finite offline rules for the generated vocabulary. The grammatical case comes from the source surface and the preceding preposition, so a source preposition stays as written even where the fake would call for another spelling (`о Осипове`). Organizations, schools and locations draw from an authored Russian or Latin vocabulary according to the script of the original, skip any name that is itself private in the text, and take a numeric suffix (`Заря-2`) once the vocabulary is exhausted. Each transformation object remembers its entity names so that two entities never share one, which makes a name depend on first appearance when two entities start on the same vocabulary entry; reuse the transformation object across documents to keep names stable, and note that this memory is not shared across worker threads or processes. `pools: {ORGANIZATION: [...], LOCATION: [...], EDUCATION: [...]}` on the fake transformation replaces a vocabulary with caller-reviewed non-empty names. Autodetected mentions are linked as in placeholder mode: a mention that appears only in oblique forms can remain a separate entity unless the value is listed in `knownPersonal`.

Implemented national checksums, IBANs and payment-card Luhn checks remain valid. Phones retain calling code, length and separators; NANP uses 555-0100–0199 and UK mobile uses 07700 900000–900999. Email/domain outputs use example.com/.test. Other national identities and phone numbers have no universal reserved range: generated arithmetic does not prove that a value is unassigned.

Generated replacements carry `faked: true`. A private bounded registry recognizes values produced by the same transformation context as `kept: 'fake'` during later inspection/verification. Caller-supplied flags and arbitrary FAKE-looking strings grant no exemption. A fresh sanitizer does not inherit that registry; reviewed persisted fake identity values can be configured through `fakeValues`. Credentials remain fully redacted unless `credentials: true` requests provider-shaped values containing FAKE and punctuation that violates token grammar. Generated personal values cannot exempt credential spans.

Faking is pseudonymisation: a private key and retained ages, relations and structure can permit linking. Keep the key out of published data. See [the realistic fake example](../examples/realistic-fakes.mjs) and [the complete requirement/research record](case-studies/issue-24/REQUIREMENTS.md).

`preserveEncoding: true` sanitizes decoded payloads with the same required engine union, re-encodes them and verifies decoding reproduces the sanitized content. Supported formats include base64/base64url, hex, percent, numeric HTML and UTF-8 byte escapes. Escaped JSON string content is sanitized and re-encoded even under default redaction so nested session JSON stays parseable. Wrapped base64 and hex keep their line width and line separator (`\n` or `\r\n`), and a wrapped run is reported as one finding. When the sanitized payload cannot be re-encoded in a form the decoder recognizes (for example hex shorter than 32 digits), the encoded text is masked as it stands rather than blocking the input. Known encoding candidates and nesting are bounded.

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

Inferred personal values propagate only inside JSON string values. They never
rewrite keys, numbers, booleans, null or structural punctuation. Direct findings
on sensitive non-identifier keys and explicitly known private keys remain
protected. Personal name labels require plausible name words; lowercase code
identifiers, product/tool words and punctuation do not establish a person.
Place labels require natural place text rather than code expressions or lowercase
status identifiers. Explicit `knownPersonal` values override these heuristics.

Oversized encoded runs receive a conservative complete-run `ENCODED_LIMIT`
redaction rather than aborting the record. Decoding probes are capped at 4,096
characters; full decoding stays capped at 8,192 characters. A multi-line run is
treated as one wrapped payload only when its probe decodes as text or its lines
share one base64 width (a multiple of four, standard alphabet, not plain hex);
lists of identifiers or commit hashes are scanned line by line. Up to 4,096
textually decodable candidates are scanned per 64 KiB window of the input;
further candidates in a denser window receive `ENCODED_LIMIT` redactions rather
than an `ERR_LIMIT` for the whole text. Whole-input, record and worker limits
still apply. This fallback can remove large non-sensitive encoded outputs; its
finding makes that decision auditable.

## Streaming and worker publication

`sanitizeStream(source, options)` accepts iterable bytes/strings and yields sanitized records. It holds incomplete lines, quoted multiline values, PEM/PuTTY blocks, netrc triplets and wrapped base64 groups across chunks. Defaults: 256 KiB batch and 1 GiB total input. Plain-text records inherit the total input limit unless `maxRecordBytes` is set explicitly; JSONL retains its 8 MiB record default. A record exceeding an explicit `maxRecordBytes` fails. Incomplete records are held whole, so memory grows with the largest held record. Boundary scans occur at geometrically increasing sizes to avoid repeated scans of long lines. The generator may have yielded earlier verified records when a later record fails. Use `sanitizeStreamToFile` for atomic publication of the whole stream.

For sessions above the whole-input limit, use `sanitizeStream(source, {structured: 'jsonl'})` alongside `engine.sanitizeJsonl(text)`. JSONL defaults to 8 MiB per record, supports arbitrary UTF-8 chunk boundaries and CRLF, and scans bounded record batches with two persistent workers in input order. `workers` selects 1–16; each worker has a 60-second job deadline. Node requests a 256 MiB old-generation heap and a 4 MiB stack; parent V8 sizing flags can override heap limits. Bun ignores worker resourceLimits, so its byte/queue limits and deadlines still apply but its worker heap is not capped. Worker failures and consumer cancellation terminate all workers. `workers: 1` runs in process; callbacks/custom sanitizers default to one and cannot be combined with parallel workers. Deno uses its in-process fallback because its Node compatibility lacks resource-limited worker threads.

Each stream carries confirmed names, MRZ components and strong personal findings
into later batches, including bounded Cyrillic/passport/GOST spelling aliases.
Workers receive ordered private registry snapshots. `maxRegistryValues` defaults
to 100,000 combined confirmed aliases and prior-token digests; exhaustion fails
with `ERR_LIMIT`. Prior unredacted word tokens and weak inspected identity spans
are retained as per-stream keyed HMAC digests, not plaintext history. Repeated
tokens are deduplicated before hashing. A late confirmation matching this history
fails with `ERR_LATE_PERSONAL`; this conservative component check can block
ordinary words reused in a later personal name, username or address. Use `sanitizeStreamToFile` or CLI streaming for
atomic publication: an unfinished generator can already have yielded earlier
records and must not be published directly. Registries are never shared between
streams. `knownPersonal` remains available for caller-confirmed private values;
`confirmedPersonal` supplies boundary-matched initial values when needed.

```js
import { createReadStream } from 'node:fs';
import { sanitizeStreamToFile } from '@link-foundation/sensitive-data-sanitizer';
await sanitizeStreamToFile(
  createReadStream('large-session.jsonl'),
  'safe.jsonl',
  {
    profile: 'publication',
    structured: 'jsonl',
    workers: 2,
  }
);
```

`sanitizeFileToFile` rejects source symlinks and writes private temporary output, publishing only after complete verification. `sanitizeFileBounded` additionally uses a worker with a 60-second inactivity deadline that resets after each verified batch (including discovery in two-pass mode) and requests a 256 MiB old-generation heap and 4 MiB stack on Node (Bun ignores those resourceLimits); `workerHeapMb` and `workerTimeoutMs` are configurable. `workerTimeoutMs` accepts integers from 1 to 2147483647; the CLI exposes it as `--worker-timeout-ms N`. A progressing file may take longer than that overall. One large record must finish within that interval; increase it for unusually costly records. JSONL record workers retain a per-batch deadline. In-process stdin/plain streams have no worker deadline. Worker failure removes its private staging directory before returning. Limits bound package work, not arbitrary external detectors. Callbacks supplied through `sanitizer` run in process; set `worker: false` explicitly to disable isolation. Pass serializable options through `sanitizerOptions` for workers. Memory limits do not include all native/WASM allocation.

```js
import { sanitizeFileBounded } from '@link-foundation/sensitive-data-sanitizer';
await sanitizeFileBounded('session.jsonl', 'session.safe.jsonl', {
  profile: 'publication',
  maxTotalBytes: 1024 * 1024 * 1024,
  maxRecordBytes: 1024 * 1024,
});
```

The CLI supports `redact FILE --stream --output NEWFILE` and stdin streaming. Stdout uses a private spool and receives nothing until the entire scan succeeds. `--max-record-bytes` controls held records; `--max-bytes` defaults to 1 GiB with `--stream`. `--json` / `--jsonl`, `--hive-mask`, `--preserve-encoding` and `--gh-auth` are explicit opt-ins. CLI redact uses the publication profile and identity masking by default; configure `identityMask: false` for full redaction.

## Public verification and publication helpers

Built-in Wikidata names/organizations, resolver/documentation IPs and role emails on known organization domains are enabled by default; `publicKnowledge: false` disables those heuristics. `knownPersonal` forces private treatment. `publicEntities` remains an audited exact override; credentials always outrank exemptions.

`createWikidataVerifier(options)` provides optional asynchronous `verifyPublic`; the CLI enables it only with `--verify-public`. It sends eligible PERSON/ORGANIZATION names to Wikidata, requires an exact label and a public-role description, caches bounded results, and blocks output on network failure. Name collisions remain possible: this is a public-name heuristic, not proof of a person's identity. Explicit private literals and sensitive relationship contexts prevent automatic exemptions. Offline mode makes no network requests.

`knownSecretsFromGitHubAuth({command, hostname, timeoutMs})` explicitly invokes local `gh auth token` and returns its nonempty exact value without diagnostics. It is never called automatically; failed authentication blocks opted-in scans. `knownSecretsFromEnv` remains separate and reads credential-named environment values or an explicit name selection.

`sanitizePayload(payload, {sanitizer})` sanitizes JSON payload values with the required union while retaining JSON structure. `createSentryBeforeSend(options)` returns a Sentry hook that drops the event (`null`) if sanitization fails. `createOutboundSanitizer(send, options)` calls the supplied transport only after successful sanitization. These helpers do not send data themselves.

The optional ESLint plugin exports `require-sanitized-output` from the package's `eslint-plugin` subpath. It checks configured outbound sinks and common GitHub CLI body/title arguments, including `--body-file`, templates and argv arrays. Configure `sinks` and `sanitizers` for your application. It is a conservative syntactic aid, not a complete data-flow proof; runtime verification remains required.

## Native documented entity catalogs

`entityCatalogs` exposes source URLs, source-page SHA256 and documented names for Google (214), Azure (180) and AWS (36). Their canonical uppercase underscore labels are recognized natively, with complete value spans, independent of cloud services. The package also implements selected automatic formats and checksum algorithms. Catalog vocabulary support does not reproduce proprietary NER, image/document inspection, regional identity validators, cloud risk analysis or their accuracy. See the coverage table for that distinction.

## Two-pass session publication

Pass `twoPass: true` to `sanitizeStreamToFile`, `sanitizeFileToFile` or
`sanitizeFileBounded` when personal values may be confirmed after their first
appearance. Pass 1 reads the source once into a private temporary input file and
collects confirmed values with every configured detector. Pass 2 reads that
snapshot and redacts with the complete registry, including in parallel JSONL
workers. Publication is atomic; success and failure remove the input spool and
unfinished output. Existing targets remain intact on failure. Raw input is
stored with mode `0600`; budget disk space for both input and sanitized output.

```js
await sanitizeStreamToFile(createReadStream('session.jsonl'), 'safe.jsonl', {
  structured: 'jsonl',
  profile: 'publication',
  twoPass: true,
  workers: 4,
});
```

The default remains one pass. `twoPass` is supported only by atomic file APIs;
`sanitizeStream` rejects it with `ERR_CONFIG`. The CLI equivalent is
`redact session.jsonl --stream --jsonl --two-pass --output safe.jsonl`, including
stdin and `--in-place`. Record, input-byte and registry bounds still apply;
discovery retains confirmed values only and does not retain prior-token history.
Required detectors run during collection and final publication verification.

Confirmation values are trimmed before normalization in both passes. Registry
matches use the `confirmed-personal` finding rule and do not seed new values
from their matched spans. Pass 2 redacts any additional confirmation without
raising `ERR_LATE_PERSONAL`; it still enforces registry limits and residual
verification. Optional `debug` reports a `two-pass-confirmation` event containing
only the entity type when that happens. One-pass streaming retains its late
confirmation guard.

Personal label values stop at escaped line breaks and quotes and are capped at
512 UTF-16 units. Phone and email labels require matching value shapes. Inferred
propagation seeds are capped at 256 units; longer detected spans are still
redacted but do not enter the propagation registry. `debug` reports a
`propagation-skipped` event containing only the type and reason when this happens.

Credential label values stay inside their logical line and enclosing JSON
string: they stop at escaped line breaks, escape sequences and the closing quote,
and never continue into the next JSON key. A qualifier such as `token for
staging:` needs a separator on the same line, verbs such as `is` must be whole
words, and generic labels such as `token`, `sig` or `secret` followed by a verb
need a generated-looking value, so prose such as `the token is valid` remains
text. A credential covering a whole escaped JSON run is redacted as one value.

Residual verification redacts the fully masked output again when any engine
still finds an actionable value, for example when raw and decoded layers
disagree about a span. Up to three additional rounds run; each reports a
`residual-redaction` debug event containing only the round number. Output that
does not converge, or whose structure becomes invalid, still fails closed with
`ERR_RESIDUAL` or the matching structured error.
Ordinary identifier keys retain their spelling unless explicitly configured as
private. Document names require a filename extension or path plus name-shaped
words or a known given name. Known CI service accounts in home paths and the
GitHub runner workspace are preserved; caller-confirmed private values retain
precedence.

Valid JSON lone surrogate escapes (such as `\ud83d`) remain escaped and round-trip
through redaction alongside emoji. Malformed UTF-8 bytes in structured JSONL still block publication
with `ERR_ENCODING`. For JSONL streams, the error includes a one-based `record`,
a zero-based absolute byte `offset`, and a zero-based `recordOffset`, identifying
the start of the malformed sequence without exposing its contents. These
positions survive bounded file workers and appear in CLI diagnostics.

## Shared tool logs and byte preservation

`credentialsOnly: true` filters all personal findings, including supplied,
known, inferred, decoded, external-detector and structured findings. Credential
findings retain the normal engine union, confidence rules and verification.
This keeps EMAIL/account-ID values without per-value `publicEntities` entries.
The default policy continues to protect personal data.

`knownSecretsFromEnv(env = process.env, names?, { minLength = 1 }?)` discovers
nonempty exact values when `names` is omitted. A name is selected when it has a
credential keyword between `_` boundaries
(`/(?:^|_)(?:TOKEN|(?:API|ACCESS|PRIVATE)?KEY|SECRET|PASSWORD|PASSWD|CREDENTIALS?|O?AUTH|PAT|COOKIE)(?:_|$)/i`)
or ends in `PASSWORD`, `PASSWD`, `TOKEN` or `COOKIE` without one. This covers
`MY_SERVICE_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, `CODEX_API_KEY`,
`OPENCODE_API_KEY`, `DASHSCOPE_API_KEY`, `HF_TOKEN`, `TELEGRAM_BOT_TOKEN`,
`PGPASSWORD`, `GITHUBTOKEN`, `OAUTH` and `SESSION_COOKIE`.
Automatic discovery excludes names whose last segment describes configuration
rather than a credential: `_TRANSPORT`, `_MODE`, `_METHOD`, `_TYPE`, `_URL`,
`_URI`, `_HOST`, `_HOSTNAME`, `_PATH`, `_ENABLED`, `_DISABLED`, `_PORT`,
`_PROTOCOL`, `_SCHEME`, `_GUARD`, `_COUNT`, `_LIMIT`, `_FILE`, `_FILENAME`,
`_DIR`, `_DIRECTORY`, `_NAME` and `_ID` (for example `HIVE_MIND_GIT_AUTH_TRANSPORT`,
`HIVE_MIND_ROUTER_AUTH_GUARD`, `MAX_TOKEN_COUNT`, `SSH_KEY_PATH`, `SECRET_NAME`
and `AWS_ACCESS_KEY_ID`), plus `GOOGLE_APPLICATION_CREDENTIALS` (a file path) and
`GIT_CONFIG_KEY_<n>` (the name of a git setting). `GIT_CONFIG_VALUE_<n>` is
selected when its `GIT_CONFIG_KEY_<n>` names a header, password, token, secret,
cookie file or auth setting, such as `http.extraheader`. Credential names such as
`AUTH_TOKEN` and `AUTH_MODE_TOKEN` still contribute their exact values, including
short/low-entropy values; no value-shape filter can reliably distinguish passwords
from configuration. Pass `minLength` to skip shorter values. An explicit array
bypasses the name exclusions; `[]` selects nothing.
These values are loaded only when the helper or CLI `--env-secrets` is requested.

`await knownSecretsFromGitHubConfig({path?})` reads `oauth_token` and `api_token`
strings from every host/account in a local YAML file. The default follows gh's
`GH_CONFIG_DIR`, `XDG_CONFIG_HOME`, Windows `AppData`, then `~/.config/gh`
precedence and appends `hosts.yml`. A missing file returns `[]`; malformed YAML,
symlinks, aliases, files above 1 MiB and read failures produce value-free
`ERR_AUTH`. YAML quoting is parsed with the `yaml` package, with alias expansion
disabled. CLI `--gh-config` adds these exact values to `knownSecrets`.
`knownSecretsFromGitHubAuth` / `--gh-auth` remain available independently.
A `hosts.yml` that uses YAML aliases or is a symlink stays a hard `ERR_AUTH`
failure, so a caller relying on `--gh-config` never runs with a silently
incomplete list.

Plain log streams and CLI file/stdin/output/in-place paths preserve invalid
UTF-8 bytes exactly. Valid Unicode keeps its normal meaning for detection.
String APIs can use a reversible view:

```js
const view = decodeLogBytes(inputBytes);
const result = await createSanitizer({ credentialsOnly: true }).sanitize(view);
const outputBytes = encodeLogText(result.text);
```

`decodeLogBytes(Uint8Array)` represents each invalid byte with an unpaired
U+DC80–U+DCFF surrogate; `encodeLogText(string)` restores those bytes. Use the
encoder when collecting `sanitizeStream` string output containing such bytes.
Ordinary UTF-8 string encoding would replace them and lose information.
`sanitizeStreamToFile` and `sanitizeFileBounded` perform the encoding themselves,
including workers and both passes. NUL bytes identify binary input and block publication by default. Plain streams accept `allowBinary: true`, and CLI file/stdin/scan/output/in-place paths accept `--allow-binary`, to preserve NUL as an ordinary byte while continuing credential detection. The opt-in is rejected for JSON/JSONL and history; it does not relax configuration/scanner validation. JSON/JSONL, scanner protocol files and configuration retain
strict UTF-8 validation; malformed bytes cannot represent valid JSON text.

Default detection keeps RFC 1918, loopback, link-local and IPv6 local addresses,
recognized auth-mode metadata, npm dependency version declarations, Actions
permission values and literal credential references. `publicKnowledge: false`
restores IP detection; explicit `knownSecrets` and `knownPersonal` retain
priority. No shell command or workflow expression is executed.

Authorization headers (including Proxy-Authorization) redact the scheme and one credential token. Whitespace, C0 controls (including NUL), DEL, quotes, backslashes and commas end the value, preserving subsequent log text in shell and escaped JSON prompts. Matching brackets opened within a token are included in its redaction; unmatched closing brackets remain part of the surrounding log. Already-redacted tokens and known credential references remain exempt after an optional scheme, including `<token>` placeholders. The debug callback receives value-free `gitleaks-rule` events with rule ID, input length and elapsed milliseconds; tracing is off by default.

## Caller-declared sensitive fields

In structured JSON/JSONL, `sensitiveFields: string[]` ignores case and removes
underscores and hyphens at any depth, like built-in document fields. For example,
`fooBar` also matches `foo_bar`, `FooBar` and `foo-bar`. The complete property value becomes
`"[REDACTED]"`, including empty strings, numbers, booleans, null, arrays and
objects. `exactFields: true` preserves exact case and punctuation in selectors. A single name matches at any depth; dotted paths such as `a.b` match from the root, and `items.*.name` matches array elements (or one object segment). This deliberate schema policy can change value types. It takes
priority over `structuralFields` and transformations, preserves property names
and surrounding whitespace, and works in both `sanitize` and `createSanitizer`.
`allowedFields: ['msg', 'level']` instead replaces every unlisted **string leaf**, including empty strings, while retaining keys, numeric/boolean/null primitives and containers. Listed strings still undergo normal detection. It supports the same paths, wildcard and exact matching; `sensitiveFields` takes priority on overlap. These selectors have no effect without `structured`. The personal-data switch
`credentialsOnly` still suppresses personal findings.

```js
sanitize('{"privateNote":"arbitrary free text","count":2}', {
  structured: 'json',
  sensitiveFields: ['privateNote'],
}).text;
// {"privateNote":"[REDACTED]","count":2}

sanitize('Lyutik работал', {
  profile: 'documents',
  knownPersonal: [{ type: 'ORGANIZATION', value: 'Lyutik' }],
}).text;
// [REDACTED] работал
```

`knownPersonal` is the synchronous custom-value list, including names without
context. For computed synchronous detection, callers can supply validated
`findings` for the exact input. `detectors` is supported in both engines; synchronous methods reject Promise-returning callbacks.

## Structural prose redaction

`properNames: 'capitalized'` is an optional, deliberately aggressive native rule
for stored prose. It works with any profile; the examples use `documents` for
its other document rules. It is off by default.

```js
sanitize('Работал в Ромашке менеджером по продажам.', {
  profile: 'documents',
  properNames: 'capitalized',
}).text;
// [REDACTED] в [REDACTED] менеджером по продажам.
```

Each string activates independently if it contains a letter from `scripts`, a
parenthesized document date range, a comma followed by an 11-digit `79…`/`89…`
mobile shape, or an HTTP(S)/bare-domain link with a `/d/<id>` path. `scripts`
defaults to `['Cyrillic']`, suitable for English operational logs; choose Unicode
Script aliases such as `['Greek', 'Cyrillic']` for your workload. Script names
are case-sensitive runtime Unicode property aliases, not language codes.
`scripts: []` disables script activation while retaining the other triggers.

Inside activated values, the rule replaces words containing an uppercase letter
anywhere (`iPhone`, `A.B`, `Санкт-Петербург`), typographic quoted spans (including
lowercase `«ромашка лютик»`), links including `example.org/path`, and bare domestic
mobile shapes. Known Cyrillic labels before a colon (`Опыт:`, `Стаж:`,
`Навыки:`) and non-Cyrillic labels (also `Label :`) stay. Unknown capitalized
Cyrillic words such as `Ромашка: менеджер` are replaced before the colon.
Lowercase words, numbers, date ranges and path tokens stay. A path can still match
existing personal-path or credential rules. Numeric primitives and JSON keys stay; string
escapes and surrounding source formatting are retained. JSON/JSONL activation
also applies independently within serialized JSON strings, to the existing
bounded decoding depth. Findings do not seed document-wide name propagation.
Repeated redaction is stable. Reusing a placeholder map for the same original
produces stable tokens and exact restoration; the existing placeholder-namespace
collision checks still reject input that already contains typed placeholders.

This is a structural heuristic, so capitalized ordinary words also disappear.
Lowercase organizations without employment context stay; the document rules
replace a lowercase employer after `работал в` / `работала в`. Complete contact
and identifier findings take priority over overlapping proper-name fragments.
English prose without a trigger (`Worked at Romashka for three years.`), isolated neutral-key values
`{"note":"Romashka"}` / `{"note":"1991-03-12"}`, and a personal website root
without a trigger stay under this rule. The existing detectors and explicit
known/sensitive-field policies still run: an unactivated value is byte-for-byte
unchanged by this additional rule, not exempt from credential detection.
`credentialsOnly` and `knownOnly` suppress automatic prose detection.

The new scanner uses a fixed number of forward passes over maximal tokens,
including long tokens without spaces. This does not impose a linear-time bound
on optional external engines or every preexisting detection rule. Debugging is
off by default; `debug` receives value-free `proper-name-prose` and
`document-experience` hit counts when those scans run. `document-prose-overlap`
reports complete-contact/identifier and suppressed broad-span counts.

CLI equivalents: `--proper-names capitalized --scripts Cyrillic,Greek`.
Configuration files accept the same `properNames` and `scripts` API options;
use a configuration file for `scripts: []`. See the runnable
[prose-log example](../examples/prose-logs.mjs).

## Rule, type and field policy

`builtInRules` is a frozen list of accepted stable `Finding.rule` ids; the complete
[rule reference](RULES.md) is generated from the bundled catalog. Unknown ids
throw `ERR_CONFIG`. For example:

```js
sanitize('Работала в компании Ромашка', {
  rules: { 'organization-context': false },
});
sanitize('{"location":"apps/api"}', {
  structured: 'json',
  fields: { location: 'scan' },
});
```

`types: { ORGANIZATION: false }` suppresses automatic built-in organization
findings. Independently matching rules can overlap: disabling one rule does not
suppress another rule's evidence. Explicit `findings` and custom detectors are
caller policy and remain active. `fields` skips built-in whole-field inference,
then scans the value normally, so a credential or email inside `location` still
gets replaced. Field names use normal case/underscore/hyphen normalization.

Credential types and rules require `allowCredentialDisable: true` before accepting
`false`. Credential findings cannot be suppressed through personal type controls
without that permission. This includes mixed encoded rules and Secretlint. The
permission intentionally reduces verification coverage; `true` enables an
already active recognizer and does not load optional detectors.

`documentEntities: false` turns off the additional document recognizers. The older
`organization-context`, `organization-cue`, personal-name/contact and multilingual
label recognizers still run. Thus `Работала в компании Ромашка` still redacts
`Ромашка`; use its rule or type control for that policy. `strict` is independent
of `documentEntities`. Defaults retain the existing policy, with the additional
catalog formats documented in COVERAGE.

## Caller document vocabulary

```js
const vocabulary = {
  roles: ['маркетолог'],
  organizationCues: ['артель'],
  educationCues: ['альма-матер'],
  personalLabels: ['личный контакт'],
  personalFields: ['contactPerson'],
};
sanitize('работаю в артели Лютик', { profile: 'documents', vocabulary }).text;
// работаю в артели [REDACTED]
```

Arrays extend the corresponding list. `{values: [...], replace: true}` replaces
one list, including an empty list. Other lists retain defaults. Replacement
changes that list's cue-based recognizers; independent legal forms, dated work
history, full names, identifiers and known values still count as evidence.
`defaultVocabulary` exposes frozen default cue lists; `documentVocabulary` exposes
the frozen multilingual document rows. Neither is modified by an operation.
Cues ignore case and support bounded Russian noun/adjective forms; personal fields
use normalized field names. Capitalized proper values are required after prose
cues. Inputs allow at most 256 nonempty strings of 128 code units per list, with
no line breaks/NUL. Unknown lists and malformed replacement records fail with
`ERR_CONFIG`. Compilation uses a bounded 64-configuration cache.

## Callback transformations and stages

```js
const sync = createSyncSanitizer({
  transformations: { PERSON: (finding) => `Person-${finding.start}` },
});
sync.sanitize('Анна Смирнова').text; // Person-0
```

`transformation(finding)` applies globally; `transformations[type](finding)` takes
precedence for that type. Each callback receives a frozen finding plus `value`,
the matched surface (decoded JSON string content when applicable), and must
return a string. Callbacks receive private data: keep it out of diagnostics.
JSON replacements are escaped, including partial string spans. Overlapping spans
are unioned and receive one callback for the selected type. Schema-level
`JSON_VALUE` denials always produce a complete redaction string.

Sync methods reject thenables with `ERR_CONFIG`; the asynchronous engine awaits
callbacks. Throws block publication. Returning the original, its normalized or
bounded encoded representation fails with `ERR_RESIDUAL`. The emitted text also
passes all configured residual detectors, so returning a new email/secret blocks.
This is bounded heuristic verification, not proof against arbitrary encodings.
Unlike built-in partial transforms, a callback deliberately controls credential
replacement too; the same checks apply. `preserveEncoding` recursively transforms
decoded content then re-encodes it.

The stages are detection → validated finding union/policy → transformation →
residual verification. `redact` exposes only the transformation stage and does not
perform residual scanning. To replace automatic detection while keeping the
sanitizer's verification step:

```js
const input = 'private customer name';
const findings = myDetector.detect(input); // exact UTF-16 offsets
const result = sanitize(input, {
  knownOnly: true,
  findings,
  knownSecrets: ['explicit-private-token'],
});
```

`knownOnly` disables automatic detectors during both detection and verification;
only configured known values and findings remain. For custom detector verification,
pass it in `detectors` with automatic detection enabled, and tune built-in rules
as needed. `createSyncSanitizer(options)` implements the exported `SyncSanitizer`
interface (`inspect` / `sanitize`); Promise-returning detectors/transforms need
`createSanitizer` instead.

## Compiled caller-known values

```js
const known = compileKnown(
  [{ type: 'ORGANIZATION', value: 'Ромашка' }],
  [{ type: 'URL', value: 'https://example.org/anna' }]
);
const merged = compileKnown(known, [{ type: 'LOCATION', value: 'Тверь' }]);
sanitize('Живу в Твери', { knownPersonal: merged });
```

Compilation copies only `{type, value, properCase?}`, deduplicates and freezes the
entries/array, and precompiles normalized projections and matching expressions.
There is no process-wide registry of caller values; weak metadata is released
with the compiled list. Mutating the input cannot change it. Compiled arrays
work with the same APIs as plain arrays, with identical output.

| Type                             | Matching behavior                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PERSON`                         | Unicode whole-word, case-insensitive; Russian cases, ё/е, reversed two-part names, supported full-name orders/initials and contiguous parts; list a part separately to match it alone |
| `ORGANIZATION`                   | Russian word forms, legal-form/quote-free core for names of at least three characters                                                                                                 |
| `EDUCATION`, `LOCATION`          | Whole-word case-insensitive with bounded Russian noun/adjective forms (e.g. МГУ / мгу, Тверь / Твери)                                                                                 |
| `URL`                            | Optional HTTP(S) scheme; query, fragment and trailing slash are consumed with the known path                                                                                          |
| `DATE`, `DATE_OF_BIRTH`, `PHONE` | Literal spellings by default; use `personalVariants(entries)` before compilation for ISO/day-first date and numeric phone variants                                                    |
| Other uppercase type ids         | Same whole-word case-insensitive and bounded Russian word forms; type labels the finding/transform and does not activate a new parser                                                 |

No helper invents transliterations. Values longer than 256 code units use literal
matching instead of word-form expansion. `properCase: true` rejects a lower-case
first character (used by reused map identities). Explicit private values remain
private despite public exceptions. The 500-entry measurement and reproduction
script are linked from COVERAGE; matching remains linear in list size.

## Optional offline recognition

Install `@nlpjs/ner@4.27.0` alongside this package, then load the separate entry:

```js
import { createNerDetector } from '@link-foundation/sensitive-data-sanitizer/ner';
const detector = await createNerDetector({ languages: ['ru', 'en'] });
const sync = createSyncSanitizer({ detectors: [detector] });
sync.sanitize('Worked at Romashka for three years.');
```

The factory loads the optional peer dependency once. Detection is synchronous,
in process and offline, with no model download or subprocess. This recognizer
uses NLP.js regex extraction with finite dictionaries and context rules; it is
not a neural model. It supports PERSON, ORGANIZATION, EDUCATION and LOCATION in
Russian/English. Unknown cue-free names can remain; see the published exact-span
precision/recall, challenge misses and per-KiB cost in COVERAGE. `languages` selects
one or both languages. Each invocation is limited to 1 Mi UTF-16 units; larger
inputs throw `ERR_LIMIT`. `debug` is off by default and emits counts only. Core
imports never load the optional entry or NLP.js; leaving it off adds no optional
runtime/module cost.

## Allow lists, suppression comments and template values

`allowList` keeps detected values that the caller has reviewed as safe, as in
Presidio's `allow_list`, Google's exclusion rules with
`MATCHING_TYPE_FULL_MATCH` and DataFog's `allowlist_patterns`. A string must
equal the whole detected value; a `RegExp` must match the whole value (it is
anchored internally, `g`/`y` flags are ignored). A partial match never shortens
a finding. At most 10 000 entries; anything else is `ERR_CONFIG`.

```js
sanitize('Contact support@example.org or alice@private.test', {
  allowList: ['support@example.org', /.+@example\.org/],
});
// → 'Contact support@example.org or [REDACTED]'
```

`inlineAllow: true` honours the suppression comments of other scanners on the
same line: `gitleaks:allow`, `betterleaks:allow`, `kingfisher:allow`/`ignore`,
`trufflehog:ignore`, `sanitizer:allow`, detect-secrets/ripsecrets
`pragma: allowlist secret` and SonarQube `NOSONAR`. A line containing
`pragma: allowlist nextline secret` suppresses findings on the next line. It is
off by default because anyone who can write to a log could otherwise disable
redaction.

Both controls follow the same safety rules:

- declared `knownPersonal`/`knownSecrets` values, confirmed personal values and
  structured `JSON_VALUE` denials are never exempted;
- credentials are exempted only together with `allowCredentialDisable: true`;
- they apply to text, structured and asynchronous paths alike.

Built-in credential rules also skip values that consist only of a template or
mask: `${PASSWORD}`, `$${PYPI_PASSWORD}`, `$DB_PASS`, `$1`, `<password>`,
`<Openverse API token>`, `[PASSWORD]`, `****`, `XXXXXXXX`, `...`, optionally
after `Bearer`/`Basic`/`token` and on either side of a `user:password` colon.
A mixed value such as `alice:${DB_PASSWORD}` or `<x>abc123…` is still redacted.
Findings from custom detectors are never dropped this way. The value-free debug
event `{event: 'template-value', rule}` reports each skipped match.

### Exempting findings with a hook

`exempt(finding, text) => boolean` keeps findings that the caller's own policy
knows are not sensitive: a configuration flag, a token counter, a version
range, a value another tool already masked. It runs after detection and before
transformation, once per finding. The finding carries `value` and the offsets
into `text`. Return `true` to keep the span unchanged and `false` to transform
it. Any other result, including `undefined` from a forgotten `return`, is
`ERR_CONFIG`.

```js
createSyncSanitizer({
  credentialsOnly: true,
  // The key before the value decides; offsets point into `text`.
  exempt: (finding, text) =>
    /FEATURE_TOKEN=$/.test(text.slice(0, finding.start)),
}).sanitize(
  'FEATURE_TOKEN=keep-this-value-123 other_token=keep-this-value-123'
);
// → 'FEATURE_TOKEN=keep-this-value-123 other_token=[REDACTED]'
```

Unlike a callback transformation that returns the original value, which fails
with `ERR_RESIDUAL`, an exempted span is excluded from residual verification
by span, not by value. Verification of the published text calls the hook again
for every finding in the output, so the same value elsewhere is still caught
unless the hook keeps that span too. The hook is explicit code, so it can keep
credential findings without `allowCredentialDisable`. Declared
`knownSecrets`/`knownPersonal` values, confirmed personal values and structured
`JSON_VALUE` denials are never offered to it.

`createSanitizer` awaits a hook that returns a `Promise`.
`createSyncSanitizer` and `sanitize()` need a synchronous hook. A `Promise`
there is `ERR_CONFIG`.

## Per-type thresholds

`minConfidenceByType` maps finding types to a threshold that overrides
`minConfidence` for those types only, as in Presidio score thresholds or
Google's per-infoType likelihood:

```js
sanitize(text, { minConfidence: 0.5, minConfidenceByType: { PERSON: 0.8 } });
```

Values must be numbers from 0 to 1. Credentials are never filtered by a
threshold.

## Character masks

The `mask` transformation accepts Presidio/Google-style tuning in addition to
`keepStart`, `keepEnd`, `minLength` and `marker`:

| Option          | Meaning                                                        |
| --------------- | -------------------------------------------------------------- |
| `char`          | One masking character (default `*`)                            |
| `ignore`        | Characters that are never masked, e.g. `'-@.'`                 |
| `ignoreClasses` | Any of `digits`, `upper`, `lower`, `punctuation`, `whitespace` |
| `count`         | Mask at most this many characters                              |
| `fromEnd`       | Mask the last `count` characters instead of the first          |

```js
sanitize('Card 4111-1111-1111-1111', {
  transformation: { mode: 'mask', char: '#', ignore: '-', count: 12 },
});
// → 'Card ####-####-####-1111'
```

`marker` cannot be combined with the tuning options. A value with nothing left
to mask is fully redacted. Masks apply to personal data only.

## Deterministic encryption

`{mode: 'encrypt', key}` replaces each personal value with
`[ENCRYPTED:TYPE:…]`, comparable to Google's `CryptoDeterministicConfig` and
Presidio's `encrypt` operator. The token is AES-256-GCM with a synthetic IV
(HMAC of type and value), so equal values of one type produce equal tokens and
joins or counts still work. Keys are at least 16 UTF-8 bytes and are expanded
with HKDF-SHA256.

```js
import { sanitize, decrypt } from '@link-foundation/sensitive-data-sanitizer';
const key = process.env.SANITIZER_KEY;
const { text } = sanitize('Mail alice@private.test', {
  transformation: { mode: 'encrypt', key },
});
decrypt(text, key); // → 'Mail alice@private.test'
```

`decrypt(text, key, {json: true})` escapes restored values inside JSON string
literals. A token that fails authentication throws `ERR_MAP`; a non-string text
throws `ERR_INPUT`. Credentials are still fully redacted and never encrypted.
Anyone holding the key can recover the values, so treat encrypted output as
pseudonymised, not anonymous.

## Declarative pattern detectors

`createPatternDetector(specs, {id})` builds a synchronous Detector from
Presidio-style pattern recognizers or Google custom infoTypes without writing
code:

```js
import {
  createPatternDetector,
  sanitize,
} from '@link-foundation/sensitive-data-sanitizer';
const detector = createPatternDetector([
  {
    type: 'MEDICAL_RECORD',
    category: 'personal',
    patterns: [{ regex: /\bMRN-\d{6}\b/g, confidence: 0.4 }],
    denyList: ['Mr. Bean'],
    context: ['mrn', 'medical record'],
    contextWindow: { before: 64, after: 16 },
    contextBoost: 0.35,
    validate: (value) => value !== 'MRN-000000',
  },
]);
sanitize('medical record MRN-123456', { detectors: [detector] });
```

| Field              | Meaning                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `type`, `category` | Uppercase type; `personal` or `credential`                                                     |
| `rule`             | Lowercase rule id (default `custom-pattern`)                                                   |
| `confidence`       | Base confidence (default 0.6)                                                                  |
| `patterns`         | Up to 64 `RegExp`, strings or `{regex, confidence, group}` (a capture group narrows the span)  |
| `denyList`         | Whole-word values, case-insensitive unless `caseSensitive: true`; `denyListConfidence` (1)     |
| `context`          | Hotwords (strings or RegExp) searched in `contextWindow` (number or `{before, after}`, ≤ 4096) |
| `contextBoost`     | Added when a hotword is present (default 0.35, floor 0.4); a negative value lowers confidence  |
| `validate`         | `false` drops a match; a number sets its confidence                                            |

Malformed specifications throw `ERR_CONFIG`.

`createIdentifierDetector(rules, {id})` adapts rules with the shape of the
exported `nationalRules` table (`{type, pattern, context, checksum, plausible?,
valid?}`) so callers can add or replace national identifiers. `identifierChecks`
exposes the checksum and format validators (Luhn, mod-11, mod-97, Verhoeff and
the national algorithms) for reuse; a valid checksum never proves issuance.

## Offline token checksums

GitHub (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`) and npm (`npm_`) tokens end in
six base62 characters holding the CRC32 of the 30 characters after the first
`_`. As in Kingfisher and osv-scalibr, the native `github`/`npm` rules and the
vendored Gitleaks/Betterleaks rules give a checksum-valid token confidence
0.99. A token whose checksum does not match keeps its ordinary confidence and
is still redacted, because truncated or retyped tokens remain sensitive. No
network request is made. The exported `tokenChecksum(value)` returns `true`,
`false` or `undefined` (not a checksummed format), and
`tokenWithChecksum(prefix, body)` builds checksum-valid test fixtures at
runtime so repositories need not store token literals.

## SARIF reports

`toSarif(report, {version, path})` converts a CLI `scan` report, an array of
`{path, findings}` or a findings array into SARIF 2.1.0 for GitHub code
scanning and other CI viewers. Rules are keyed by `finding.rule`; credential
findings are `error` and personal findings `warning`. Regions carry
`charOffset`, `charLength`, `startLine` and `startColumn` in UTF-16 code units.
Skipped files become tool execution notifications. Values are never included.

```sh
sensitive-data-sanitizer scan --format sarif src > results.sarif
```

`--format` accepts `json` (default) or `sarif` and is only valid for `scan`.

CLI `scan` accepts several paths, so a CI step or a
[pre-commit](https://pre-commit.com) hook can pass the staged files directly.
The repository ships `.pre-commit-hooks.yaml` with two hooks:
`sensitive-data-sanitizer` (credentials only) and
`sensitive-data-sanitizer-pii` (credentials and personal data).

```yaml
repos:
  - repo: https://github.com/link-foundation/sensitive-data-sanitizer
    rev: v0.20.0
    hooks:
      - id: sensitive-data-sanitizer
```
