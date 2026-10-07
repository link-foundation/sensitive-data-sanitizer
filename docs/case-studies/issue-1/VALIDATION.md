# Reproduction and validation

All fixtures are synthetic. The initial minimum test failed because the arithmetic template exported no `createSanitizer`; the implementation then made contextual passwords, PII, public-policy, overlap, Unicode/encoding and fail-closed fixtures pass. Subsequent regressions reproduced malformed encoded-engine ranges and approved multiword-name over-masking before their fixes.

## Automated checks

```sh
npm ci
npm test
npm run check
npm run check:secrets
bun test --timeout 30000
deno test --allow-read --allow-env
```

Run runtime suites sequentially in one checkout: Deno's automatic npm directory management can replace `node_modules` while another runtime is using it. Restore `npm ci` before returning to Node/Bun tooling. Secretlint's `debug` dependency enumerates environment variables during import, so the Deno test command requires environment permission; missing permission blocks sanitization, rather than silently omitting the required scanner.

The review follow-up adds all 26 named reviewer examples, including full credential spans with ampersands/spaces/escaped quotes, multilingual prose, national-format PII, default names, public contacts and provider formats. Before implementation all 26 failed; the default async engine now passes each. Additional fixtures cover every documented catalog label, 17 languages with eight PII fields each, Unicode digits, transformations, public/private overlap, native RE2 offset mapping, HTML/byte/JSON encoding, external-only encoded findings, and fail-closed outbound/Sentry/ESLint boundaries.

Bounded stream tests check every UTF-8 split, quoted/PEM/base64 held records, a file larger than 10 MiB, late invalid UTF-8 with no publication, and a one-millisecond worker deadline with staging cleanup. Explicit known-private entries override manual/online public policy and are never sent for verification. Synthetic local GitHub authentication is invoked only by opt-in tests. Deno runs library cases; filesystem/subprocess integration uses the existing Node/Bun framework. Template arithmetic and its CLI remain tested under explicit legacy entries.
No real exposed token is necessary to reproduce a rule: fixtures construct a provider prefix and finite synthetic suffix. CLI tests inspect output and status and establish that scanner errors never echo their synthetic input/stderr. The read-only history regression records refs before/after auditing. `experiments/history-rewrite-integration.mjs` additionally executes pinned git-filter-repo 2.47.0 on a disposable fresh clone: it sanitizes deleted blobs, commit/tag messages, author identities and a sensitive filename, re-audits reachable objects and paths, confirms the source HEAD is unchanged, and confirms the clone has no remote or private plan files.

## Actual external engines

```sh
node experiments/issue-1-external-scanners.mjs /absolute/path/to/binaries
node experiments/issue-1-presidio.mjs /absolute/path/to/python
```

Install tools/models separately before running these opt-in experiments. Gitleaks 8.30.1 and TruffleHog 3.99.0 each passed the credential/publication cases, including encoded synthetic token input. TruffleHog verification and update operations were disabled. The first encoded TruffleHog attempt exposed decoded `Raw` mapping; rerunning after the adapter fix passed. Executable versions and tool rule sets matter, so these results do not prove all future versions compatible.

Presidio analyzer 2.2.364 with spaCy 3.8.16 and installed `en_core_web_sm` 3.8.0 redacted through both the API and CLI a synthetic unlabelled `John Smith` following an emoji, plus a contextual short password. The output was `😀 [REDACTED] visited [REDACTED]. password=[REDACTED]`: the model also classified `yesterday` as DATE_TIME. This illustrates both working codepoint mapping and potential over-redaction. An English model is not evidence of multilingual semantic recall.

## Bounded resource experiment

```sh
node --max-old-space-size=256 --stack_size=1024 experiments/issue-1-bounded-inputs.mjs
```

Finite probes cover a 1 MiB affixed key, ordinary long prose and normalized full-width input. After correcting the URL-scheme boundary, a local run measured approximately 2.6 seconds / 11 MiB ending JS heap for the affixed-key case, 0.4 seconds / 14 MiB for ordinary prose, and 2.4 seconds / 74 MiB for normalized input. These are local observations, not peak RSS or a production throughput guarantee; typed-array backing memory is separate from reported heap. The deliberately overlong key affix is outside contextual recognition and remains unchanged, while a normalized supported credential is masked.

The initial bounded probe exposed excessive repeated scheme-regex starts and was stopped before exhausting the host. A long-identifier regression now verifies the fixed behavior. Input, projections, decoded candidate/depth counts, findings, file/object counts and subprocess output/time are bounded. Unsupported encodings may evade detection; explicit limit violations block output.

## CI investigation

The initial security run `37605066104` failed before implementation: preserved log line 2084 reports that dependency review was unsupported without an enabled dependency graph, with the gate failing at lines 4217–4219. Enabling repository vulnerability alerts restored the dependency comparison endpoint. Raw CI logs are saved under ignored `ci-logs/` for investigation rather than committed with potentially sensitive job output. Final PR checks must be evaluated against the latest commit SHA and run timestamps, not the earlier template-only result.

The first implementation push (`b15a57d`) passed the six Node/Bun jobs, Security, Workflows and Broken Link Checker. Example app run `37613323368` failed to resolve `@secretlint/core` at saved log lines 224, 475, 740 and 1006 because the browser imported the root Node entry. The local Vite build also exposed unsupported `node:net` imports. The retained arithmetic now has an independent browser entry, with a package-resolution regression and a successful local Vite build. Playwright verified the built app in a real browser: entering 6 and 7 produced Addition 13 and Multiplication 42. The browser and preview server were closed afterward.

Checks and release run `37613323397` failed the same existing release-helper test in all three Deno jobs; log lines 13986–13993 identify `tests/wait-for-npm.test.js:325`. Adding required scanner environment permission exposed `GITHUB_OUTPUT`, which the helper read globally despite the test supplying its own environment. The helper now uses that supplied environment for outputs as well. Reproduce the CI environment with `GITHUB_OUTPUT=/tmp/issue-1-deno-output deno test --allow-read --allow-env tests/wait-for-npm.test.js`; before the fix it failed 1 of 20 tests, and afterward all 20 passed without granting write permission.

The initial implementation passed Node/Bun 666 tests and Deno 521 tests. The review follow-up passed Node 786 tests, Bun 786 tests and Deno 641 tests (8 steps), with no failures. Lint, formatting, duplication, secret scanning, workflow policy, syntax, documentation and declaration checks passed. Packaging installation and both CLI smoke tests passed. Final CI results are recorded in [PR #2](https://github.com/link-foundation/sensitive-data-sanitizer/pull/2) against its latest SHA. The finite recognition/model and transformation limits in [coverage](../../COVERAGE.md) remain even after all checks pass.

The packed-installation check is reproducible with `npm pack --pack-destination /tmp` followed by `node experiments/issue-1-package-smoke.mjs /tmp/link-foundation-sensitive-data-sanitizer-0.11.31.tgz`. It installs the archive in a disposable directory, verifies the required-scanner API and sanitizer bin, and checks the legacy arithmetic bin. Declarations are checked with `deno check src/index.d.ts src/legacy.d.ts src/eslint-plugin.d.ts`.

## Executed comparison

The [benchmark](../../../experiments/benchmark/README.md) commits 223 synthetic cases with 210 annotated sensitive spans, source/corpus fingerprints, pinned default configurations, raw ranges and an executable runner. The sanitizer covered 210/210 full spans with no false predictions in this development corpus. Gitleaks, TruffleHog, detect-secrets, Presidio and scrubadub were independently executed; their counts and scope differences are recorded alongside the output. This is not a held-out population sample, overlap precision does not measure excess redaction, and proprietary services were not executed.

The first review-follow-up CI run `37674557754` used SHA `b86c3e4` and failed its Changeset gate: saved log line 1129 reports six added fragments where exactly one is required; line 3300 identifies `changeset-check` as the failing job. The fragments are consolidated into the single minor release note. CodeQL check `112974886154` also found a polynomial prose-boundary regex at `src/context.js:107`: repeated tabs caused matching to restart at every character. A finite 128 KiB-tab child with a two-second deadline, 128 MiB heap and 1 MiB stack failed before the fix. Restricting the match to the beginning of a whitespace run preserved the credential span and completed the same probe in approximately 4 ms. `tests/sanitizer-context.test.js` retains the bounded regression; benchmark results were rerun with the corrected source fingerprint.
