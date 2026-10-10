# Sensitive Data Sanitizer

An offline JavaScript library, detector framework, and CLI for redacting credentials and personal data from UTF-8 logs, AI sessions, and text files. It combines required Secretlint and 221 bundled Gitleaks text rules with contextual credentials, default multilingual name/PII recognition, known values and bounded encoding detection. Optional local Gitleaks, TruffleHog, and Presidio detectors extend the union.

Library calls without a profile replace every actionable finding completely with `[REDACTED]`. Personal findings below the default confidence threshold of 0.5 remain inspectable without replacing ordinary log numbers; credentials always qualify. Publication methods verify full redaction and block output if a required detector fails or finds a residual. Optional typed transformations, compatible partial masks and encoding preservation are described in the API. Findings contain offsets and rule metadata; they omit matched values and source excerpts.

For publishing sessions, use `createSanitizer({profile: 'publication'})`:
the personal threshold is 0.3, identity values use the fixed first/last-two
`***` mask, and fake-identity exemptions remain disabled. CLI `redact` defaults
to this profile. Explicit configuration such as `identityMask: false` selects
complete redaction. Credentials always receive complete redaction unless an
explicit credential transformation is selected.

Detection has limits: the default 17-locale name gazetteer has finite vocabulary; unfamiliar names need an additional NER model or known-personal dictionary. New token formats, unsupported encodings, and unconfigured languages can escape detection. Successful verification means the enabled detectors found no residual, not that the input is universally anonymous. See [coverage and limits](docs/COVERAGE.md) and the [issue #1 case study](docs/case-studies/issue-1/README.md).

## Quick Start

Sanitizer APIs require Node.js 22.13 or later. Template arithmetic utilities are available under `@link-foundation/sensitive-data-sanitizer/legacy`; the existing universal example uses that browser-compatible entry. From this checkout:

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
sensitive-data-sanitizer scan logs --config /private/policy.json
sensitive-data-sanitizer redact input.txt --gitleaks --trufflehog --output safe.txt
sensitive-data-sanitizer redact input.txt --presidio /path/presidio-bridge.py --model en_core_web_sm --language en
sensitive-data-sanitizer redact large-session.jsonl --jsonl --stream --output safe-session.jsonl
sensitive-data-sanitizer history rewrite ./repository --output ./private-preview
sensitive-data-sanitizer --help
```

`--output` creates a new file without clobbering an existing one. `--in-place` replaces the input atomically after verification. Intermediate and output files use mode `0600` on POSIX. Symlinks, malformed UTF-8, and binary input are refused. Directory scans omit `.git` and `node_modules`; skipped binary/invalid/oversized files make the report incomplete. Stdout is written after the complete operation succeeds.

| Exit | Meaning                                                                  |
| ---- | ------------------------------------------------------------------------ |
| 0    | Redaction succeeded, or a complete scan found nothing                    |
| 1    | A complete scan/history audit found sensitive data                       |
| 2    | Error, detector failure, or incomplete scan; redaction output is blocked |

Defaults: 10 MiB whole-text input bytes, 100,000 findings and 10,000 files. `--stream` permits 1 GiB total with 1 MiB plain-text records or 8 MiB JSONL records, bounded workers and atomic publication. `--max-bytes` sets the byte limit; JSON config sets the other sanitizer limits. `--paranoid` adds entropy heuristics and increases false positives. `--native-only` explicitly disables Secretlint.

## Configuration

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
and structure and is pseudonymisation. See [realistic fakes](examples/realistic-fakes.mjs)
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

The framework also accepts Gitleaks, TruffleHog, detect-secrets, Presidio, or explicitly typed offset reports. Cloud reports can be converted locally; the package itself makes no cloud requests.

For CLI name recognition, `--presidio PATH` selects a local Python JSON bridge. `--python COMMAND` selects its interpreter, and `--model` / `--language` select an already installed model. These options require the bridge and participate in final-output verification.

## Git history

`history` audits reachable blobs, commit messages/authors, annotated tags, and reflog-reachable objects without changing refs. It can find deleted files. It reports object hashes and safe findings, and refuses limits or reports skipped binary objects as incomplete. The `history rewrite SOURCE --output NEW_DIRECTORY` command previews private replacement/mailmap files in a fresh mirror clone; add `--apply` to rewrite only that clone and re-audit blobs, metadata, paths and refs. It never pushes. Remote caches, forks, artifacts and unreachable objects require separate remediation; see the [history guide](docs/HISTORY-REMEDIATION.md).

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

## License

Released under the [Unlicense](LICENSE). External components keep their own licenses; see [component provenance](docs/case-studies/issue-1/COMPETITORS.md).
