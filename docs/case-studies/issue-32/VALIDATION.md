# Issue 32 validation

The baseline regression run demonstrated the reported filename/name leaks,
weak national-ID scores, public/code/booking false positives, malformed JSON
escape output and missing stream propagation. Reusable synthetic probes live in
`experiments/issue-32/`; no private session files were available or published.

## Reproduction and regression evidence

The initial fixture run failed before implementation. Additional regressions
were added before fixing each newly found gap: confirmation inside encoded
credential-containing strings, late compound usernames/addresses, publication
threshold consistency, reverse GOST diacritics, and initial confirmation registry limits. The existing escaped-MRZ
regression caught an encoding wrapper being promoted to an identity seed; wrapper
exclusion fixes that failure while preserving decoded-name propagation.

Fresh hosted CodeQL first detected a polynomial filename-label guard despite
passing runtime jobs. A new 128 KiB tab-suffix regression failed at its bounded
two-second work deadline before the fix and completed in 290 ms afterward.
The repeated whitespace groups are now separated by a required quote, retaining
field-label semantics. The complete suites were rerun after this final fix;
CodeQL and all exact-head checks are verified separately in PR 33.

The coordinator-finding reuse tests use a required custom detector to show that
input detection and final residual verification both run. A detector that first
reports a secret during residual verification still raises `ERR_RESIDUAL`.

Runtime tests cover synchronous/native/async APIs, both exact JSONL minimal
reproductions, raw JSON escape units, Claude/Codex containers, diffs/test output,
ordered workers 1/4, supplied sanitizers, atomic ToFile publication, a 1.7 MB MRZ
session, registry bounds, late confirmations and per-stream isolation. The full
existing suites retain all earlier delivered capabilities.

## Complete local verification

| Runtime      | Command                                                                 | Result                              | Wall time |
| ------------ | ----------------------------------------------------------------------- | ----------------------------------- | --------- |
| Node 26.11.0 | `node --test --test-timeout=30000 --test-concurrency=2 tests/*.test.js` | 1,208 passed, 0 failed/cancelled    | 123.41 s  |
| Bun 1.4.2    | `bun test --timeout 30000`                                              | 1,208 passed, 0 failed              | 144.07 s  |
| Deno 2.9.6   | `deno test --allow-read --allow-env`                                    | 1,063 passed plus 8 steps, 0 failed | 74.53 s   |

Node uses two concurrent test files on this six-core shared workspace, retaining
the original 30-second per-test deadline. An earlier default-concurrency run
overran the large-record budget under CPU contention. Bun subsequently exposed
an independent duplicate-scan timeout; serial prepared findings and parallel
coordinator finding reuse fixed the repeated work. Neither regression deadline
was increased. Runtime suites run sequentially because Deno manages node_modules;
`npm ci` restores dependencies before subsequent Node/npm tooling.

Final lint review split structured analysis and its test group into smaller
functions without changing detection. The focused session/escape/stream suites
passed all 92 cases on Node, Bun and Deno after that refactor; current-head hosted CI also covers the complete
runtime matrix.

The first Deno run exposed two test-harness write-permission failures. The
read-only suite now keeps the in-memory CLI profile assertions and gates only
filesystem work on permission. A separate Deno run with `--allow-write` passed
all 14 CLI/stream-identity tests, including configuration overrides, atomic file
publication and staging cleanup; no filesystem assertion was removed.

`npm run check` passes lint, Prettier and the repository duplication budget.
Changed JavaScript also passes ESLint with zero warnings. `npm run check:secrets`,
49-script syntax validation, the 312-file line guard, required documentation,
workflow pin/policy checks and the no-manual-version guard pass. `git diff --check`
passes. The normal PR Changeset guard confirms one added minor fragment after
committing; existing main fragments are preserved.

The directory-only Changeset scan initially counted six pending fragments,
including five already on main. PR comparison is the required guard: this branch
adds exactly one minor fragment and makes no manual package-version change.

## Finite session throughput

`experiments/issue-32/session-throughput.mjs` generates 26 nested session records,
2,191,272 UTF-8 bytes, with a confirmed name near the start and reused filename
plus credential near the end. Every output record parses; neither private value
survives. Run with:

```sh
node --max-old-space-size=256 --stack-size=1024 experiments/issue-32/session-throughput.mjs
```

| Mode              | Time    | Throughput  |
| ----------------- | ------- | ----------- |
| `sanitizeJsonl`   | 2.793 s | 0.748 MiB/s |
| Stream, 1 worker  | 2.069 s | 1.010 MiB/s |
| Stream, 4 workers | 2.500 s | 0.836 MiB/s |

All three modes completed with 26 valid records and no surviving confirmed name
or credential.

This is one finite synthetic measurement, including cold required-engine/worker
setup, not a universal throughput guarantee. Four-worker startup can dominate
this small corpus. The separate seven-megabyte record and ten-megabyte worker
publication regressions retain their original timeouts. Reusable bounded timing
and encoded-MRZ probes are also committed in `experiments/issue-32/`.

## Installed package and external limits

A fresh `npm pack` archive installed into an isolated npm prefix passes API and
installed CLI checks (two nested JSONL records). The installed CLI reports the
manifest version, 0.11.31; its offline `npm exec` launcher also reports 0.11.31.
Both updated publication-profile examples pass, including two-worker atomic file
publication. The minor Changeset schedules the next version through release CI.

The packed installation checks manifest/CLI version consistency, default-engine
SNILS protection, installed CLI publication of nested JSONL, and distant name
reuse. This verifies package contents independently of the checkout. It cannot
verify a public registry package that still returns E404.

First npm publication and green post-merge main release CI remain externally
blocked by missing npm owner publishing authority/settings. The strict release
preflight is unchanged; exact owner steps and preserved failure-log line numbers
are in [REQUIREMENTS.md](REQUIREMENTS.md). Current-head hosted CI status is
recorded in [PR 33](https://github.com/link-foundation/sensitive-data-sanitizer/pull/33)
after pushing the final commit, with timestamps and SHAs checked separately from
the prepared branch's earlier green runs.
