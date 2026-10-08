# Session accuracy, realistic fakes and bounded JSONL

All nine children of [issue 24](https://github.com/link-foundation/sensitive-data-sanitizer/issues/24) are handled in [PR 25](https://github.com/link-foundation/sensitive-data-sanitizer/pull/25). [REQUIREMENTS.md](REQUIREMENTS.md) enumerates every requested behavior, alternatives, selected plans and primary-source component research; [issues.json](issues.json) preserves the parent, child descriptions and comments.

## Reproductions and causes

The first session regression run failed 47 of 49 minimal cases. Bare national checksums had the same high score as labelled identities; auth substring matching accepted author; broad date vocabulary caught ordinary headers; label ranges included no/number; assignment credentials swallowed prose; and independent findings could neither group specimen MRZ lines nor propagate confirmed values into paths. The generic visa grammar also accepted words without identifier evidence, which could reappear under a different projected context during residual verification. Two individual negative examples already passed; the broader issue cases reproduced.

The initial JSONL worker tests all failed with ERR_CONFIG: the existing stream option path rejected structured JSONL and had no ordered record pool. Fake mode was absent. An installed-tarball smoke test also reproduced inherited eval/V8 flags breaking file workers; a child-process regression covers both. The German specimen fragment is bounded independently of adjacent real identities. Additional property tests caught malformed fake dates/MRZs, catalog aliases, IBAN arithmetic and PESEL/Swedish date-century transitions before correction. Independent century decoding caught a year-2000 birth shifting incorrectly to 2099 instead of 1999; generation now re-encodes the shifted century.

Final diff review caught three card regressions. Support/report/runtime labels could match port/time suffixes and suppress a valid card; Unicode letter/number boundaries now distinguish those labels from genuine metadata keys. A 13-digit Visa/Luhn-valid number also represented a year-2096 epoch in milliseconds; card detection now requires identity context for that ambiguous number. CREDIT_CARD_NUMBER and CREDIT_DEBIT_NUMBER aliases previously bypassed checksum generation; they now share native payment-card fakes. Each fix has a test that failed before the correction.

| Issues    | Shared implementation                                                                                                  | Automated evidence                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 15–16     | Confidence policy, numeric negatives, card IIN/length gates, auth component boundaries, personal-only dates            | `tests/sanitizer-session-regressions.test.js`; existing identity/locale suites          |
| 17–18, 21 | Grouped document specimen policy, exact spans, phone vocabulary/trunk formats, visa grammar and projection consistency | Session regressions, identity boundary and structured/projection suites                 |
| 19–20     | Context/filename recognizers and confirmed-value propagation, including reordered unknown name components              | Session regressions and multilingual name suites                                        |
| 22        | Keyed locale-aware generators, shared dates, checksums/MRZs, reserved contact destinations and private provenance      | `tests/sanitizer-fake.test.js`; independent `mrz` parser and mod-97 checks              |
| 23        | Byte-bounded JSONL records, persistent ordered workers, scanner keyword indexing/windows, release Changeset            | `tests/sanitizer-jsonl-stream.test.js`, scanner equivalence tests and bounded benchmark |

Low-confidence evidence remains inspectable. Credentials bypass the personal threshold and outrank personal/specimen exemptions. Every first-pass, encoded, structured, asynchronous-engine and residual path uses the shared policy. Existing partial masks and format-preserving pseudonyms retain their contracts; realistic faking is an additional opt-in mode.

## Local verification

Complete suites passed sequentially against the final lockfiles: Node 1,112 tests, Bun 1,112 tests, and Deno 967 tests plus eight steps. The shared npm directory was restored with npm ci after Deno before package and quality checks. Lint, Prettier, duplication (below 10%), Secretlint, syntax, tracked-file size and required-document guards passed. Changed code has zero ESLint warnings; the ten existing warnings on unchanged lines remain unchanged.

The installed-tarball smoke test runs in a separate consumer directory and verifies realistic fake mode, required default scanners, parallel JSONL workers and the packaged CLI. PR 25 records CI results for the pushed commit separately from these local results.

## Performance and resource bounds

Run the finite benchmark from the repository root:

```sh
node --max-old-space-size=512 --stack-size=4096 experiments/issue-24/session-benchmark.mjs
```

On the development container (Node 26.11.0), three isolated runs of 160 tool-result records totaling 4,300,210 bytes measured:

| Path                                                        | Median time | Median throughput (range) | RSS after completion (range) |
| ----------------------------------------------------------- | ----------- | ------------------------- | ---------------------------- |
| Whole-input JSONL, required default engines                 | 5.258 s     | 0.82 MB/s (0.63–0.85)     | 190–200 MiB                  |
| Ordered JSONL stream, two workers, required default engines | 4.201 s     | 1.02 MB/s (0.98–1.25)     | 304–318 MiB                  |

These are measured results for the committed synthetic session corpus, including cold worker setup, not a throughput guarantee for every session or machine. The initial smaller 1.075 MB corpus took 4.2 seconds (0.256 MB/s) before optimization. Keyword indexing removes repeated whole-input literal searches; scanner windows preserve complete matches and are checked against the vendored RE2 expressions, including emoji, multiline prefixes and unbounded tokens.

Records default to at most 8 MiB for JSONL, batches to 256 KiB unless a single record is larger, total input to 1 GiB, and one queued job per worker. Node workers request a 256 MiB old-generation heap and a 4 MiB stack; parent V8 sizing flags can override heap limits. [Bun ignores worker resourceLimits](https://bun.com/docs/runtime/nodejs-compat), so only byte/queue bounds and job deadlines apply there. Native/WASM memory is additional. Tests process two records each above 7 MiB, exceeding the whole-text limit, with split UTF-8, CRLF, ordering, deterministic fakes, malformed input, limits, worker failure and cancellation. Deno uses the documented in-process fallback. Profiling also found that the plain stream rescanned incomplete batches and rebuilt a base64 regex on every line. Removing that repeated work brought the existing Bun 11 MiB worker test below its unchanged 30-second budget (27.9 seconds); parallel 7 MiB JSONL records took 19.1 seconds. Stream propagation is scoped to each scanned batch; known-personal dictionaries supply identities across separate batches.

## Release evidence and remaining external prerequisite

The required minor Changeset prepares release without manually changing package versions. Faker's supported runtime raises the sanitizer minimum to Node 22.13.0; Node 24 remains the recommended development runtime.

Deno initially stopped before running tests because libphonenumber-js 1.13.15 was published on the test date. Selecting the previous 1.13.14 release and updating both lockfiles preserves [Deno's default 24-hour dependency-age policy](https://docs.deno.com/runtime/packages/supply_chain/). The complete Deno suite then passed 967 tests and eight steps. Node and Bun include additional subprocess tests unavailable under Deno's read/env-only permissions.

Fresh registry inspection still returned npm 404. The main release run [37769979635](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/37769979635), created 2026-10-08 11:25:48 UTC at SHA 2306fda, failed first-publication preflight: npm OIDC token exchange returned 404 and NPM_TOKEN was unavailable (preserved log lines 151–158). The existing release workflow already supports a bootstrap token followed by trusted publishing. No available credential can publish the first package; this PR cannot claim registry publication has happened. A repository/npm owner must supply the first-publication credential through the existing release configuration after merge.

The separate main example workflow [37769979827](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/37769979827) failed because GitHub Pages was not enabled (log lines 180–181 and final status 1727–1730). This is an existing repository configuration failure, unrelated to sanitizer code. Current-head PR validation is checked independently.

No issue is deferred to another implementation PR. Format-valid generated identities are pseudonyms, and unavailable reserved national ranges cannot guarantee that an invented number is unassigned. Keep keys and reviewed policies private.
