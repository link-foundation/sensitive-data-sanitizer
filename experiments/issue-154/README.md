# Private-key type override regression

Issue: https://github.com/link-foundation/sensitive-data-sanitizer/issues/154

## Requirements and plan

- [x] Read the complete issue, comments, required sub-issues and PR feedback.
      There were no comments, sub-issues, inline review comments or reviews on #154/#161.
- [x] Identify the root cause and reproduce the disclosure with an automated test.
- [x] Expose a stable `PRIVATE_KEY` type for native PEM and PuTTY findings.
- [x] Verify per-type full redaction under global `hive-mask`, preserving PEM
      markers, surrounding text and partial masking of ordinary credentials.
- [x] Cover both public entry points, sync/async engines, JSON, encoded payloads
      and streaming; retain default redaction and explicit partial masking.
- [x] Document the type change and prepare a patch changeset for release.
- [x] Review the implementation, tests and documentation in the PR diff.

Final CI verification is tracked on [PR #161](https://github.com/link-foundation/sensitive-data-sanitizer/pull/161)
against its latest pushed commit. The PR description records the final result.

## Root cause and solution

Both `private-key` in `src/detection.js` and `putty-private-key` in
`src/credentials.js` emitted `SECRET`. Rendering selects
`transformations[finding.type]`, so a `PRIVATE_KEY` override was unreachable.
The existing PEM span refinement already preserves armor and narrows findings
to the body; the existing renderer already performs complete redaction.

Set the two native findings to `PRIVATE_KEY`, retaining category `credential`,
rule IDs and detector spans. Reserve the new type in the placeholder namespace.
The issue permits either a stable type or rule-specific transformations; the
stable type uses the existing public policy interface without another option.
Vendor rule labels retain their existing types; native detection participates
in the engine union and supplies the private-key override.

## Reproduce and verify

```sh
node --test --test-concurrency=1 --test-timeout=30000 tests/sanitizer-issue-154.test.js
```

Before the fix, all 14 original regression cases failed: native findings reported
`SECRET`; the stream case exposed `SYN…456` instead of `[REDACTED]`. After the fix,
all 14 passed. An additional case checks the reserved placeholder namespace.
All 36 focused checks pass with the existing credential-format and PuTTY
regressions. Changed JavaScript passes ESLint with zero warnings and all changed
files pass Prettier.
Fixtures are synthetic and finite. Tests cover PEM, RSA, EC, DSA, OpenSSH,
encrypted PEM, CRLF and literal escaped newlines, PuTTY v2/v3, unterminated PEM,
JSON and base64, both entries and async Secretlint union detection. No detector
or renderer is duplicated. Existing optional `debug` events remain available.
