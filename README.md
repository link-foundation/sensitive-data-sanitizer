# Sensitive Data Sanitizer

[Documentation index](docs/README.md) · [Use cases](docs/USE-CASES.md) · [API](docs/API.md) · [Coverage](docs/COVERAGE.md) · [Comparison](docs/COMPARISON.md) · [Contributing](docs/CONTRIBUTING.md)

An offline JavaScript library, detector framework, and CLI for redacting credentials and personal data from logs, AI sessions, and text files, including logs with invalid UTF-8 bytes. It combines required Secretlint, 221 bundled Gitleaks text rules and 203 further Betterleaks rules with contextual credentials, default multilingual name/PII recognition, known values and bounded encoding detection. Optional local Gitleaks, Betterleaks, TruffleHog, and Presidio detectors extend the union.

Library calls without a profile replace every actionable finding completely with `[REDACTED]`. Personal findings below the default confidence threshold of 0.5 remain inspectable without replacing ordinary log numbers; credentials always qualify. Publication methods verify full redaction and block output if a required detector fails or finds a residual. Optional typed transformations, compatible partial masks and encoding preservation are described in the API. Findings contain offsets and rule metadata; they omit matched values and source excerpts.

For publishing sessions, use `createSanitizer({profile: 'publication'})`:
the personal threshold is 0.3, identity values use the fixed first/last-two
`***` mask, and fake-identity exemptions remain disabled. CLI `redact` defaults
to this profile. Explicit configuration such as `identityMask: false` selects
complete redaction. Credentials always receive complete redaction unless an
explicit credential transformation is selected.

Detection has limits: the default 17-locale name gazetteer has finite vocabulary; unfamiliar names need an additional NER model or known-personal dictionary. New token formats, unsupported encodings, and unconfigured languages can escape detection. Successful verification means the enabled detectors found no residual, not that the input is universally anonymous. See [coverage and limits](docs/COVERAGE.md) and the [issue #1 case study](docs/case-studies/issue-1/README.md).

For real session files whose personal values are confirmed later, use atomic
two-pass publication:

```sh
sensitive-data-sanitizer redact session.jsonl --stream --jsonl --two-pass --output safe.jsonl
```

For loggers that only mask credentials, import the
[credentials-only entry](docs/API.md#credentials-only-entry)
`@link-foundation/sensitive-data-sanitizer/credentials`: it skips the
personal-data modules and starts about three times faster. Both entries also
support `require`.

For synchronous log hooks, `createSyncSanitizer` supports custom detectors and
verified callback transformations. Rule/type controls, caller vocabulary,
structured field selectors and `compileKnown` configure reusable policies; see
[API examples](docs/API.md#rule-type-and-field-policy) and the
[runnable log policy](examples/custom-log-policy.mjs). The optional `/ner` entry
adds offline Russian/English symbolic recognition with
[published coverage and cost](docs/COVERAGE.md#optional-offline-recognition-measurements).

For explicitly enabled, bounded provider authentication checks, see
[credential verification](docs/VERIFICATION.md). Checks are disabled by default
and never change redaction decisions. The current catalog covers twelve
providers; it does not cover every popular service or token type.

## Quick Start

For stored prose that can tolerate extra redaction, opt into structural proper
names independently for each string value:

```js
sanitize('Работал в Ромашке менеджером по продажам.', {
  profile: 'documents',
  properNames: 'capitalized',
}).text;
// [REDACTED] в [REDACTED] менеджером по продажам.
```

The rule defaults to Cyrillic or structural data triggers, keeps JSON keys and
numbers, and supports caller-selected Unicode `scripts`. It is off by default.
See [activation rules and limits](docs/API.md#structural-prose-redaction) and the
[prose-log example](examples/prose-logs.mjs). CLI:
`redact input.jsonl --jsonl --proper-names capitalized --profile documents`.

### Readable placeholders and document profiles

Use the opt-in `documents` profile for CVs and similar prose. It adds bounded
employer, school, city and region detection across the existing 17 locales.
Default and publication log profiles keep their existing detection behavior.

```js
import { sanitize, restore } from '@link-foundation/sensitive-data-sanitizer';

const result = sanitize('Jane Doe worked at Acme Ltd in Springfield.', {
  profile: 'documents',
  transformation: { mode: 'placeholder' },
});
// result.text: Person-1 worked at Organization-1 in Location-1.
// Keep result.map private. Share only result.text.
restore(result.text, result.map); // exact original document
restore('Ask Person-1 about Organization-1.', result.map); // derived answer
```

The restore map **is personal data**. It contains original spellings and private
occurrence metadata; never commit it, send it to a model, or publish the whole
result object. The CLI writes maps separately with mode `0600`, and publication
checks reject serialized restore maps. Reuse `result.map` in the next
`transformation.map` to keep IDs stable across files. JSON and Links Notation
serializations carry the same versioned map. Credentials stay fully redacted
and out of the map unless explicitly opted in.

```sh
sensitive-data-sanitizer redact cv.txt --profile documents --placeholder --map private.lino --output safe.txt
sensitive-data-sanitizer restore safe.txt --map private.lino --output restored.txt
sensitive-data-sanitizer redact cv.txt --profile documents --placeholder --no-map
```

`knownOnly: true` (CLI `--known-only`) limits replacement to `knownPersonal`,
`knownSecrets` and reused map identities, preserving fictional examples.
Placeholder results report `irreversibleRedactions`; a nonzero count means some
replacements, such as credentials excluded from the map, cannot be restored.

Known Russian names match in all six cases and in any word order, with `ё`/`е`
spelling variants and initials (`с Петровым Данилом Сергеевичем`, `Петров Д. С.`,
`Данил П.`), also when a line break or a comment prefix splits them, when
table, CSV, quote or Markdown punctuation separates them (`Петров, Данил`,
`| Петров | Данил |`, `**Петров** Данил`), in plural forms (`Петровы`,
`у Рабиновичей`, `с Ковальчуками`), when the
parts sit in the name fields of one record (`{"first_name": "Данил",
"last_name": "Петров"}`, CSV, YAML, SQL, XML, query strings) and when they are
percent-encoded, HTML-escaped, carry stress marks, invisible characters or
look-alike letters of another script. Name fields also join as Markdown
list items (`- **Фамилия:** Петров` and `- **Имя:** Данил`) and key/value
table rows (`| Фамилия | Петров |`), and bold or italic markers around a key
or value stay outside the finding. Separated parts are replaced one by one,
so `| Петров | Данил |` becomes `| Person-1 | Person-1 |`. An initial must be
an upper-case letter.
A part of a longer name is matched alone only when it is listed itself; a given
name with a patronymic counts as such a part. Flag an entry with
`identifiers: true` to find it inside code identifiers (`petrov_id`,
`getPetrovName`) or `transliterate: true` to find Latin spellings of a Cyrillic
name (`Danil Petrov`); see the [example](examples/known-names-in-code.mjs).
Standalone Cyrillic surnames require an uppercase first letter in prose.
Use `properCase: false` on an entry or as a `compileKnown` default to match
these surnames in lowercase prose as well.

With `properNames: 'capitalized'`, placeholder output keeps the sentence around a
name (`Кандидат Person-1`, `Меня зовут Person-1`, `Благодарим Вас, Person-1`), and
`transformation.existing: 'keep'` lets a second pass over sanitized text keep its
`Type-n` tokens and number new values after them. `isPlaceholderToken` and
`reservedPlaceholderTypes` expose the namespace; see the
[second-pass example](examples/second-pass-placeholders.mjs).

For irreversible output, choose `transformation: { mode: 'placeholder', map:
false }`: no restore map is returned or written. Detection limits still apply
in either mode. See the [placeholder API](docs/API.md#reversible-placeholders),
[coverage](docs/COVERAGE.md#document-entities), and
[runnable example](examples/reversible-placeholders.mjs).

Sanitizer APIs require Node.js 26.13.1 or later. Template arithmetic utilities are available under `@link-foundation/sensitive-data-sanitizer/legacy`; the existing universal example uses that browser-compatible entry. From this checkout:

```sh
npm ci
node bin/sensitive-data-sanitizer.js redact session.jsonl --output session.safe.jsonl
node bin/sensitive-data-sanitizer.js scan ./logs
node bin/sensitive-data-sanitizer.js history ./repository
```

The npm package is `@link-foundation/sensitive-data-sanitizer`; the installed executable is `sensitive-data-sanitizer`. This PR prepares its release through Changesets.

First npm publication currently requires owner setup; see the
[verified release blockers and exact setup steps](docs/case-studies/issue-32/REQUIREMENTS.md#exact-npm-owner-steps).

```js
import {
  createSanitizer,
  knownSecretsFromEnv,
} from '@link-foundation/sensitive-data-sanitizer';

const sanitizer = createSanitizer({
  profile: 'publication',
  knownSecrets: knownSecretsFromEnv(), // Explicitly include local credentials.
});
const result = await sanitizer.sanitize('password=short person@example.org');
console.log(result.text); // password=[REDACTED] [REDACTED]
```

`createSanitizer()` requires the pinned Secretlint recommended rules to succeed. The synchronous `sanitize()` and `inspect()` functions use the native rules only. `redact()` applies supplied findings without a residual scan. Prefer the asynchronous sanitizer for publication.

## CLI

```sh
printf 'password=short\n' | sensitive-data-sanitizer redact -
sensitive-data-sanitizer redact input.txt --in-place
sensitive-data-sanitizer scan logs --config /private/policy.lino
sensitive-data-sanitizer scan src/a.js src/b.js --format sarif > report.sarif
sensitive-data-sanitizer scan --staged --credentials-only
sensitive-data-sanitizer redact input.txt --gitleaks --trufflehog --output safe.txt
sensitive-data-sanitizer redact input.txt --presidio /path/presidio-bridge.py --model en_core_web_sm --language en
sensitive-data-sanitizer redact large-session.jsonl --jsonl --stream --output safe-session.jsonl
sensitive-data-sanitizer history rewrite ./repository --output ./private-preview
sensitive-data-sanitizer --locale hi --help
```

`--output` creates a new file without clobbering an existing one. `--in-place` replaces the input atomically after verification. Intermediate and output files use mode `0600` on POSIX. Symlinks are refused. NUL-containing input is refused by default; `--allow-binary` explicitly preserves NUL bytes in plain logs while credentials are still sanitized. JSON/JSONL remain strict. Plain logs preserve invalid UTF-8 bytes exactly; JSON/JSONL and configuration files require valid UTF-8. Directory scans omit `.git` and `node_modules`; skipped binary/malformed-structured/oversized files make the report incomplete. Stdout is written after the complete operation succeeds.

| Exit | Meaning                                                                  |
| ---- | ------------------------------------------------------------------------ |
| 0    | Redaction succeeded, or a complete scan found nothing                    |
| 1    | A complete scan/history audit found sensitive data                       |
| 2    | Error, detector failure, or incomplete scan; redaction output is blocked |

Defaults include 32 MiB whole-text input bytes, 100,000 findings and 10,000 files. `--stream` permits 1 GiB total with plain-text records up to the total input limit or 8 MiB JSONL records, bounded workers and atomic publication. `--worker-timeout-ms N` sets the worker inactivity/per-batch deadline (default 60000 ms). Verified file progress resets the deadline, so large files can run longer overall. `--max-bytes` sets the byte limit. The policy file sets the other sanitizer limits. `--paranoid` adds entropy heuristics and increases false positives. `--native-only` explicitly disables Secretlint.

`scan` and `history` emit Links Notation reports by default. Use `--format json` for existing JSON consumers. `scan` also supports `--format sarif` (SARIF 2.1.0), `--format csv` and `--format junit`. Reports contain safe finding metadata. Use `--report-path PATH` to create a private report file without overwriting an existing file.

`scan --staged` reads changed Git index blobs, including when the working copy has unstaged edits. `scan --respect-gitignore` reads tracked and non-ignored untracked working-tree files. Both modes use the current directory and accept optional literal paths. Use `--` before paths beginning with a dash. The repository's `.pre-commit-hooks.yaml` provides `sensitive-data-sanitizer` (credentials only) and `sensitive-data-sanitizer-pii` (credentials and personal data) hooks for [pre-commit](https://pre-commit.com). UTF-16 files with a byte order mark retain their encoding during redaction.

`scan --max-archive-depth N` enables ZIP, TAR and GZIP scanning. Each enclosing format uses one depth level, so `nested.tar.gz` uses two. The maximum is five. Each input shares its `--max-bytes` budget across decompressed layers and a limit of 10,000 entries. Members are read in memory. Unreadable, unsupported or over-limit members make the report incomplete.

To adopt scanning on an existing repository, set `SDS_BASELINE_KEY` to 32 random bytes encoded as 64 lowercase hexadecimal characters in your local or CI secret store. From the same working directory, run the scans with the same policy.

```sh
sensitive-data-sanitizer scan --respect-gitignore --write-baseline /private/baseline.lino
sensitive-data-sanitizer scan --respect-gitignore --baseline /private/baseline.lino
```

Review the first report before using the baseline. A complete scan can write a baseline and still exit 1 for findings. Each keyed fingerprint suppresses one exact finding value per path and rule even if its line moves. Changed values, new paths and additional occurrences remain visible. A missing or malformed key fails the scan. Losing or changing the key requires a fresh review. Keep the key separate from the baseline. Baselines apply to scan reports and their exit status. Redaction and residual verification always use the original policy.

## Configuration

The CLI accepts a readable [Links Notation](https://github.com/link-foundation/links-notation) policy file through `--config PATH` or `SDS_CONFIG`. JSON policy files remain supported. An explicit flag overrides the environment setting. For example, the following policy enables the documents profile and sets the findings limit.

```lino
(
  profile "documents"
  maxFindings 10000
)
```

Help and diagnostics are available in English, Russian, Chinese and Hindi through `--locale en|ru|zh|hi` or `SDS_LOCALE` (English by default). Detection already inspects all four languages independently of that setting.

For AI sessions, `--jsonl` preserves JSON records and declares `id`, `type`,
`name`, and `description` as metadata. `--json` handles a single JSON document;
use JSONL for streaming. Known private values and credential formats still
override declarations. Set `structuralFields` in private config to choose your
own property names, or use an empty array to scan every field normally.
The library provides `structured: 'json' | 'jsonl'` and
`engine.sanitizeJsonl(text)` with an empty structural policy by default.

For input above the whole-text limit, pass an iterable to
`sanitizeStream(source, {structured: 'jsonl', profile: 'publication'})` or use `sanitizeStreamToFile` for
atomic output. JSONL defaults to two ordered record workers. See [the streaming
example](examples/stream-jsonl.mjs).

Native coverage includes tolerant passport MRZ fragments, country passport
formats, PNR/ticket/visa identifiers, contextual birth dates, national IDs and
messenger phone numbers. `identityMask: true` (the publication/CLI redact default) uses
2+2 characters with a fixed `***` marker. Opt-in fake identity policies retain
audited specimen/synthetic values while credentials remain protected.
See [the API](docs/API.md) and [all issue 13 requirements and research](docs/case-studies/repository-issue-13/REQUIREMENTS.md).

`transformation: {mode: 'fake', key}` generates deterministic names, valid
dates/MRZs/checksummed IDs and reserved email/domain destinations. Credentials
remain fully redacted by default. Keep the key private: this preserves relations
and structure and is pseudonymisation. Russian mentions of one known person or
entity share one fake identity declined to match the source (`Петров … С Петровым`
becomes `Баранов … С Барановым`), and `pools` overrides the entity names. See [realistic fakes](examples/realistic-fakes.mjs)
and [the complete issue 24 requirements, research and solution plans](docs/case-studies/issue-24/REQUIREMENTS.md).

Keep policies containing real private values outside Git. Built-in exact public knowledge and narrowly scoped role/domain heuristics are enabled offline. Explicit private literals override public exemptions. Keep custom public policies reviewed against evidence; `--verify-public` separately opts into Wikidata name lookup:

```json
{
  "knownSecrets": [],
  "knownPersonal": [{ "type": "PERSON", "value": "Private Person" }],
  "publicEntities": [
    {
      "type": "EMAIL",
      "value": "contact@example.org",
      "source": "https://example.org/contact",
      "reviewedAt": "2026-10-07"
    }
  ]
}
```

Reviewed false positives can be kept with `allowList` (whole-value strings or anchored regexes) or, opt-in, with `inlineAllow: true`, which honours `gitleaks:allow`, `pragma: allowlist secret` and similar comments; credentials stay redacted unless `allowCredentialDisable: true` is also set. `minConfidenceByType` sets per-type thresholds, the `mask` transformation accepts `char`, `ignore`, `ignoreClasses`, `count` and `fromEnd`, and `{mode: 'encrypt', key}` produces deterministic AES-256-GCM tokens that `decrypt(text, key)` restores. See [the API](docs/API.md#allow-lists-suppression-comments-and-template-values) and [the competitor comparison](docs/COMPARISON.md).

Custom policies preserve exact reviewed `PERSON`, `ORGANIZATION` and `EMAIL` detections. Built-in public resolvers/documentation IPs are also exempt. Credential detections always win, including a public email used as a password or authorization value. Evidence is an explicit caller decision and does not make every occurrence harmless.

## Extend detection

```js
import {
  createSanitizer,
  createGitleaksDetector,
  createTrufflehogDetector,
  createPresidioDetector,
} from '@link-foundation/sensitive-data-sanitizer';

const sanitizer = createSanitizer({
  detectors: [
    createGitleaksDetector(),
    createTrufflehogDetector(),
    createPresidioDetector({ args: ['/absolute/path/presidio-bridge.py'] }),
  ],
});
```

Install external binaries and language models separately. TruffleHog runs with verification and updates disabled. The Presidio example checks for an installed model and never downloads it at analysis time. Each selected detector is required, including during residual verification. See [the API and adapter contract](docs/API.md), [combined scanners](examples/combined-scanners.mjs), and [the local NER bridge](examples/presidio-bridge.py).

`createPatternDetector([{type, patterns, denyList, context, validate}])` adds Presidio-style pattern recognizers or Google-style custom infoTypes with hotword boosts, and `createIdentifierDetector` adds national identifiers with checksum validators; see [declarative pattern detectors](docs/API.md#declarative-pattern-detectors).

The framework also accepts Gitleaks, TruffleHog, detect-secrets, Presidio, or explicitly typed offset reports. Cloud reports can be converted locally; the package itself makes no cloud requests.

For CLI name recognition, `--presidio PATH` selects a local Python JSON bridge. `--python COMMAND` selects its interpreter, and `--model` / `--language` select an already installed model. These options require the bridge and participate in final-output verification.

## Git history

`history` audits reachable blobs, commit messages/authors, annotated tags, and reflog-reachable objects without changing refs. It can find deleted files. It reports object hashes and safe findings, and refuses limits or reports skipped binary objects as incomplete. The `history rewrite SOURCE --output NEW_DIRECTORY` command previews private replacement/mailmap files in a fresh mirror clone; add `--apply` to rewrite only that clone and re-audit blobs, metadata, paths and refs. It never pushes. Remote caches, forks, artifacts and unreachable objects require separate remediation; see the [history guide](docs/HISTORY-REMEDIATION.md).

Scope a local history audit with `--from` and `--to` commit references or `--since` and `--until` UTC dates. An applied rewrite writes `manifest.lino` by default. Use `--format json` for `manifest.json`. See the [history guide](docs/HISTORY-REMEDIATION.md) for the scope semantics.

## Contributing

```sh
npm test
npm run check
bun test --timeout 30000
deno test --allow-read --allow-env
```

See [contributing](docs/CONTRIBUTING.md). `add`, `multiply` and `delay` live in the `legacy` subpath, with the `sensitive-data-sanitizer-legacy` CLI and retained universal app; inherited pipeline instructions are in [the template guide](docs/TEMPLATE-PIPELINE.md).

### Auto-regenerated preview screenshots

The universal app's preview images regenerate on pushes to the default branch. Run `npm run example:web:preview-images` to regenerate them locally; see [the template guide](docs/TEMPLATE-PIPELINE.md) for setup.

Automatic `--env-secrets` discovery also selects `PGPASSWORD`-style suffixes and cookies, and skips configuration names such as `GIT_AUTH_TRANSPORT`, `AUTH_MODE`, `*_AUTH_GUARD`, `MAX_TOKEN_COUNT`, `SSH_KEY_PATH`, `SECRET_NAME`, `AWS_ACCESS_KEY_ID` and `GIT_CONFIG_KEY_<n>`; `knownSecretsFromEnv(env, undefined, { minLength: 8 })` also skips short values. Explicit `knownSecretsFromEnv(env, names)` selections still include their exact values.

For shared tool logs, `--credentials-only --env-secrets --gh-config` preserves
public account details while redacting credential patterns and exact local
secret values. Environment discovery matches credential-related variable names,
including AI-provider keys; `--gh-config` reads every host/account token from the
local GitHub CLI `hosts.yml`. Both local sources are opt-in. Literal references
such as `${{ secrets.NPM_TOKEN }}` and `$(gh auth token)` remain readable; actual
credential values are still redacted.

Long plain-text records are held until a safe boundary, including credentials
longer than a 64 KiB input chunk. Memory grows with the largest held record;
set `--max-record-bytes` for a smaller deployment budget. Crossing an explicit
record or total limit blocks atomic publication. See [the tool-log integration
example](examples/shared-tool-logs.mjs) and [API byte handling](docs/API.md).

## License

Released under the [Unlicense](LICENSE). External components keep their own licenses; see [component provenance](docs/case-studies/issue-1/COMPETITORS.md).
