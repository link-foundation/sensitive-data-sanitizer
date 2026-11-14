# Issue 180: NUL credential boundaries

## Requirements and work plan

The issue has no comments or required sub-issues. PR 183 has no conversation
comments, inline comments or reviews at the start of this investigation.

- [x] Read the complete issue, PR feedback, contributing guide and related PRs.
- [x] Reproduce the data loss and identify the detector responsible.
- [x] Keep the NUL and all non-secret bytes following a credential, including
      multiple NUL-delimited fields and line endings.
- [x] Verify whole-input and streaming CLI paths with `--allow-binary` and
      `--credentials-only`, including stdin, files, `--max-bytes` and `--output`.
- [x] Preserve existing obfuscated/interleaved credential detection and ordinary
      whitespace boundaries.
- [x] Add a regression that fails before the fix and passes afterward.
- [x] Add a patch changeset for the automated release.

Branch publication, final diff review, current-main ancestry, final-commit CI
and readiness are recorded in [PR 183](https://github.com/link-foundation/sensitive-data-sanitizer/pull/183).

Focused checks run locally; full runtime and platform coverage runs in CI.
Local install, experiment and test output is kept in ignored `ci-logs/` files.

## Root cause and fix

`projectText()` removed every NUL as an invisible character. The supplemental
GitHub rule then scanned `ghp_…two` instead of `ghp_…\0two`, and its mapped
finding covered the original token, NUL and suffix. A second, independent
problem affected assignments: `valueRange()` did not stop at NUL, so a context
finding could still swallow the suffix even with the projection fixed.

Ordinary NULs now remain in the detection view. Uniformly interleaved runs of
at least four characters still decode, including runs embedded in prose. The
run scan keeps the NUL beside a multi-character field; this prevents a token
from absorbing subsequent one-character fields as well. It scans each run
once without a repeated regexp group or per-character collection. Unquoted
query, line, prose and token values stop at NUL.

No scanner was disabled. Existing value-free debug callbacks already expose
rule timings and finding counts, so additional tracing was unnecessary.

## Reproduction and verification

```sh
node --max-old-space-size=256 experiments/issue-180/reproduce.mjs
node --max-old-space-size=384 --test --test-timeout=30000 tests/sanitizer-issue-50.test.js
```

The experiment uses only synthetic credentials and bounded inputs. Before the
fix, the first row produces `line\0one [REDACTED]\n`; afterward it produces
`line\0one [REDACTED]\0two\n`.

The new issue-180 regressions live in the existing issue-50 file to preserve
CI shard assignments. Against the original source, three fail: synchronous/
asynchronous preservation, every stream split, and CLI byte preservation.
The interleaved-text compatibility case passes before and after the fix.
All 25 tests in that file pass after the fix. Coverage includes GitHub,
OpenAI and npm tokens, assignments, Authorization and Cookie values, multiple
NUL fields, LF/CRLF/no final newline, another projection trigger, repeated
sanitization and interleaved runs embedded in text. Sixteen CLI combinations
cover stdin/files, whole/streamed input, default/credentials-only policies and
stdout/output files, with explicit byte limits and invalid UTF-8 preservation.

The related issue-47, issue-50, issue-128-features, issue-142-context and
issue-177 suites pass together: 98 tests, no failures or skips. Changed
JavaScript passes ESLint with zero warnings and Secretlint; all changed files
pass Prettier and `git diff --check`.

The first CI run exposed an older issue-168 projection assertion that expected
a trailing NUL to disappear. Its expected text and source spans now retain
that separator. All 31 tests in issue-168 and issue-50 pass together locally.
The saved Windows Node log reports that assertion at line 5556, and the
Windows Deno log at line 1968; both belong to run 43541158090 on commit
`3d0fc40`. Final CI validation uses the subsequent commit.
