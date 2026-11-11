# Short encoded Hive masks and escaped JSON policy views

Issue: https://github.com/link-foundation/sensitive-data-sanitizer/issues/153
PR: https://github.com/link-foundation/sensitive-data-sanitizer/pull/160

## Root causes

General base64 candidates require at least 16 characters. Hive masking changes a
40-character credential into `gho…999`, whose base64 spelling `Z2hv4oCmOTk5`
has only 12 characters. Context and Gitleaks still flag that spelling as a
credential value, so internal verification redacts it again.

Escaped JSON has a separate issue: native and external detection maps decoded
findings to the whole encoded view, while the exemption hook normally sees only
source offsets. A decoded view that is clean under that hook retains a stale
outer finding. Rendering interprets unchanged recursive output as no progress and
replaces the view with `[REDACTED]`.

Exact known-secret protection also requires scanning original encoded bytes when
a declared value normalizes (the ellipsis becomes three periods under NFKC).
Otherwise the short-mask exemption could hide its canonical encoded spelling.

## Changes and evidence

| Requirement                                 | Implementation                                                                                                                                  | Automated evidence in `tests/sanitizer-issue-153.test.js`                                                                                     |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserve short encoded masks                | Built-in credential policy recognizes canonical UTF-8 base64/base64url spellings of a whole Hive mask or `[REDACTED]`, bounded to 64 characters | Exact reproduction, padded/unpadded variants, URL alphabet, three passes through sync and async engines                                       |
| Preserve first/last three and log structure | Re-encoded masks survive verification                                                                                                           | Escaped GHCR log fixture, exact complete-record equality after first and subsequent calls                                                     |
| Apply configured policy inside escaped JSON | Independent sync/async engine inspection, including supplied detectors and hook, removes only findings whose decoded view has no findings       | Exempt token assignment, async hook, independent async detector                                                                               |
| Bound recursive inspection                  | At most three additional levels and 8192 source characters, matching the existing decoder bound                                                 | Three clean levels; fourth level retained; malformed and oversized supplied findings retained                                                 |
| Retain sensitive material detection         | Exact known bytes scanned alongside normalized forms; arbitrary text and partial/noncanonical masks receive no exemption                        | Explicit known plaintext/encoded mask, known token plus a second real credential, arbitrary decoded text, partial masks and malformed padding |
| Optional tracing                            | Existing `debug` callback gains `exempt-decoded-view`, off by default                                                                           | Event presence and absence of credential values                                                                                               |
| Release and documentation                   | Patch changeset and updated API/types                                                                                                           | Changeset guard and CI                                                                                                                        |

No required sub-issues were listed. The issue's follow-up comment and all three
PR comment/review endpoints were read. The downstream encoding probe and GHCR
regression in Hive Mind PR 3741 supplied the fixture shape. Recent merged PR 155
supplied the existing mask-policy approach and regression style.

## Reproduce and verify

```sh
node --test --test-concurrency=1 --test-timeout=30000 \
  tests/sanitizer-issue-153.test.js \
  tests/sanitizer-issue-142-config.test.js \
  tests/sanitizer-issue-142-encoding.test.js \
  tests/sanitizer-issue-148.test.js
node examples/encoded-credential-logs.mjs
```

Before the source fix, the original short-mask test, escaped GHCR log, synchronous
policy view and asynchronous policy view all failed. After the source fix, all
48 focused tests pass. The expanded issue-specific suite has 11 tests; it also
passes after extracting the async screening helper to satisfy lint's function
size limit. Changed JavaScript passes ESLint with zero warnings and changed
files pass Prettier. The complete runtime/platform/security suite runs in CI.

Local setup used Node 26.13.0. The provided npm 11.20.0 required a local force
flag to install the committed graph and run the pre-commit hook because the
manifest requires npm 12.2.2. No dependency manifests or locks were changed.
