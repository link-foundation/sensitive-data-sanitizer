# Sensitive Data Sanitizer

An offline JavaScript library, detector framework, and CLI for redacting credentials and personal data from UTF-8 logs, AI sessions, and text files. It combines required Secretlint rules with contextual credentials, service formats, known values, multilingual labels, and bounded encoding detection. Optional local Gitleaks, TruffleHog, and Presidio detectors extend the union.

Every detected value is replaced completely with `[REDACTED]`. Publication methods scan the result again and block output if a required detector fails or finds a residual. Findings contain offsets and rule metadata; they omit matched values and source excerpts.

Detection has limits: arbitrary names in prose need an installed NER model or known-personal dictionary. New token formats, unsupported encodings, and unconfigured languages can escape detection. Successful verification means the enabled detectors found no residual, not that the input is universally anonymous. See [coverage and limits](docs/COVERAGE.md) and the [issue #1 case study](docs/case-studies/issue-1/README.md).

## Quick Start

Sanitizer APIs require Node.js 22 or later. Browser package resolution retains the original `add`, `multiply` and `delay` arithmetic utilities through a separate entry; the existing universal example uses that entry. From this checkout:

```sh
npm ci
node bin/sensitive-data-sanitizer.js redact session.jsonl --output session.safe.jsonl
node bin/sensitive-data-sanitizer.js scan ./logs
node bin/sensitive-data-sanitizer.js history ./repository
```

The npm package is `@link-foundation/sensitive-data-sanitizer`; the installed executable is `sensitive-data-sanitizer`. This PR prepares its release through Changesets.

```js
import {
  createSanitizer,
  knownSecretsFromEnv,
} from '@link-foundation/sensitive-data-sanitizer';

const sanitizer = createSanitizer({
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
sensitive-data-sanitizer --help
```

`--output` creates a new file without clobbering an existing one. `--in-place` replaces the input atomically after verification. Intermediate and output files use mode `0600` on POSIX. Symlinks, malformed UTF-8, and binary input are refused. Directory scans omit `.git` and `node_modules`; skipped binary/invalid/oversized files make the report incomplete. Stdout is written after the complete operation succeeds.

| Exit | Meaning                                                                  |
| ---- | ------------------------------------------------------------------------ |
| 0    | Redaction succeeded, or a complete scan found nothing                    |
| 1    | A complete scan/history audit found sensitive data                       |
| 2    | Error, detector failure, or incomplete scan; redaction output is blocked |

Defaults: 10 MiB input bytes, 100,000 findings, and 10,000 files. `--max-bytes` sets the byte limit; JSON config sets the other sanitizer limits. `--paranoid` adds entropy heuristics and increases false positives. `--native-only` explicitly disables Secretlint.

## Configuration

Keep policies containing real private values outside Git. A public-data policy must be reviewed against organization-controlled evidence; the sanitizer does not browse or infer public status:

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

Only exact reviewed `PERSON`, `ORGANIZATION`, and `EMAIL` detections can be preserved. Credential detections always win, including a public email used as a password or authorization value. Evidence is an explicit caller decision and does not make every occurrence harmless.

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

`history` audits reachable blobs, commit messages/authors, annotated tags, and reflog-reachable objects without changing refs. It can find deleted files. It reports object hashes and safe findings, and refuses limits or reports skipped binary objects as incomplete. It does not erase remote caches, forks, artifacts, filenames, or unreachable objects. Follow the [history remediation guide](docs/HISTORY-REMEDIATION.md) for a separate reviewed rewrite.

## Contributing

```sh
npm test
npm run check
bun test --timeout 30000
deno test --allow-read --allow-env
```

See [contributing](docs/CONTRIBUTING.md). `add`, `multiply`, `delay`, the `example-package-name` CLI, and the universal app example remain available; inherited pipeline instructions are in [the template guide](docs/TEMPLATE-PIPELINE.md).

### Auto-regenerated preview screenshots

The universal app's preview images regenerate on pushes to the default branch. Run `npm run example:web:preview-images` to regenerate them locally; see [the template guide](docs/TEMPLATE-PIPELINE.md) for setup.

## License

Released under the [Unlicense](LICENSE). External components keep their own licenses; see [component provenance](docs/case-studies/issue-1/COMPETITORS.md).
