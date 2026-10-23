# Validation evidence

All checks use the prepared branch and finite benchmark inputs. Logs are kept
outside tracked source or in ignored `ci-logs/`; this document records outcomes
and precise failures without credential values.

## Reproductions before fixes

- Public-log regressions: 12 failures before exemption fixes.
- Lossless log byte tests: `ERR_ENCODING` before decoder changes.
- > 1 MiB credential header stream: `ERR_LIMIT` before record-default changes.
- 25 KB repeated A: Firebase regex 2,912.95 ms, complete sync sanitize 6,201.41 ms.
- After token-boundary fix, 100 KB Firebase scan: 3.79 ms (four times the input).
- Early 1 MB base64 probe after only the first regex fix: 51,015 ms; profiling
  identified email starts, RE2 contextual rules and repeated WASM input copies.

## Local validation

Node's full suite passes **1,399 tests** (135.1 seconds, concurrency 2 and
256 MiB per-process JS heap). The later YAML diagnostic regression reproduced
one warning before `logLevel: 'silent'` and passes after the fix.
Deno's final full suite passes **1,254 tests plus 8 steps** in 104 seconds;
an additional write-enabled run passes **28 tests** in 6 seconds, exercising
actual credential-file reads, silent YAML parsing and both byte-publication
passes. Bun's final full suite passes **1,399 tests** with zero failures in
145.25 seconds. Runtime suites were run sequentially within the container limit;
hosted CI separately verifies the unchanged per-runtime execution budgets.

`npm run check` (lint, formatting, duplication), secret scanning, syntax,
required-doc checks and clean-tarball installation pass. The tarball contains
78 files, includes the shared-tool example, loads the required scanner union,
round-trips invalid bytes and runs both CLI entry points. `npm ci` reports zero
vulnerabilities. All 221 vendored regex rules compile in RE2JS.

An intermediate full Node run
passed 1,381 of 1,385 tests; four stale private-IP / invalid-byte expectations
were updated to the issue's new behavior while retaining strict JSONL, binary
and explicit private-address policy tests.

An initial Bun run found a 30-second file-worker timeout and shared WASM heap
exhaustion. The separator precheck and whole-record large-engine selection fix
both: all 14 focused tests passed; the 12 MB worker took 18.9 seconds. A bounded
Authress prefix view subsequently removes a full-record capture scan while
preserving the vendored bounded expression and offsets.

The finite seeded 15.7 MB synchronous benchmark completed with a 256 MiB JS heap:

| Input                                      | Time     | Process RSS after case | Findings |
| ------------------------------------------ | -------- | ---------------------- | -------- |
| 15,700,000 repeated A characters           | 11.211 s | 223.4 MiB              | 0        |
| 15,700,012 seeded random base64 characters | 34.122 s | 410.2 MiB              | 291      |
| 15,700,012 zero-filled base64 characters   | 11.089 s | 380.0 MiB              | 0        |

RSS is the sample at the end of each case, not a continuously sampled maximum.
The random corpus intentionally remains subject to credential rules; suspicious
substrings are redacted rather than exempting images from inspection. These are
container measurements, not a hard latency guarantee on all hardware.

## Existing CI failures investigated

Prepared head 6f723c6, Security Checks run
[39991121764](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/39991121764),
created 2026-10-23 16:57:50 UTC:

- Root audit job 120542827128: `launch-editor <=2.14.1`, high severity, fixed
  compatibly at 2.14.2 in the lock file.
- Example audit job 120542827350: `vite <=6.4.3`, high severity, compatible
  lock-file remediation. Preserved job log lines 103–123 identify the affected
  package/advisories and exit status.

Latest main release run
[38456752244](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/38456752244):

- OIDC exchange 404, no NPM_TOKEN fallback at log lines 153–160.
- Deno Windows reached its 100-second suite budget (lines 19461–19466).
  Dependency startup/cold-cache work is included in that measurement; investigate
  the new-head run before changing deadlines. A passing PR cannot resolve the
  separate npm credential blocker.
