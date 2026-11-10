# Issue 151: Markdown credential documentation boundaries

## Plan and requirement map

Read issue 151, its full comment list, PR 158 conversation/inline comments and
reviews, the linked downstream release-note regression, and recent related
PRs 143/145/155 before finalizing the change. Issue 151 and PR 158 had no feedback
or required sub-issues. The downstream migration PR supplies context; its
unrelated migration work is outside this issue.

| Requirement                                    | Implementation                                                                                                       | Verification                                                                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserve all five issue reproductions          | Backticks end unquoted context and angle values before exemption checks                                              | Exact unchanged text and empty findings; three passes; sync and async credentials entry                                                           |
| Preserve complete placeholder syntax           | Accept Markdown boundaries for variable/Actions/gh references; retain complete braced variables before token parsing | Angle placeholders, shell variables, braced variables, Actions references and gh lookup; single/double backticks and exact delimiter-run matching |
| Preserve the public authority opt-out          | Exempt only the exact `HIVE_MIND_CLAUDE_AUTH_AUTHORITY=conventional` pair                                            | Plain and Markdown forms; reject other authority names, enums and appended literal material                                                       |
| Keep real credentials masked                   | Reuse angle-value parsing for CLI flags; detect values after `token`, `Bearer` and `Basic` keywords                  | HTML/script literal, opaque literal, prefixed credentials and material glued to placeholders; assert the actual secret is absent                  |
| Keep known secrets authoritative               | Known-secret detection and exemption prohibition remain in force                                                     | Each of the five documentation values explicitly declared as a known secret                                                                       |
| Preserve neighboring prose and later detection | Narrow each context value independently                                                                              | Later credential after documentation; existing issue 148 repeated masking coverage                                                                |
| Preserve encoded behavior                      | Shared parser applies to decoded views                                                                               | Base64 documentation; existing encoding tests                                                                                                     |
| Prepare release                                | Patch changeset                                                                                                      | `.changeset/issue-151-markdown-values.md`; CI release guards                                                                                      |

## Root cause and experiments

The context value parser treated a closing Markdown backtick as part of an
unquoted value. Angle placeholders therefore failed the whole-value check,
and configuration values no longer matched their enum or numeric patterns.
`AUTH_AUTHORITY=conventional` also lacked an exact public configuration pair.

The first new regression run failed five of seven checks, including the
original text, async behavior, complete variables and later prose preservation.
The retained `inspect.mjs` probe prints synthetic inputs, findings and output.
Before the fix it showed `password=<secret>` losing the closing code delimiter
and `<tokens>` losing both the delimiter and following space.

Strengthening the security assertions to check the secret itself, rather than
only the entire prefixed value, exposed an existing gap: `password=token
<literal>` masked just `token`. The shared token-value parser now scans through the credential after
that keyword. It keeps the keyword in the value used for metadata checks, so
`token conventional` cannot qualify for the exact `conventional` exemption. CLI flags also reuse angle parsing, so an HTML/script literal
cannot escape simply because its value starts with `<`. Quoted literals keep
embedded backticks; Markdown-wrapped values are still scanned. Existing optional
`debug` detection/template events remain available and default off.

Final review also reproduced a new Markdown parsing edge case: a two-backtick
opener closed prematurely at the first two characters of a three-backtick run,
leaving later literal credential material visible. The added regression failed
before correction. Markdown now closes only at a run of exactly the opening
length. Each run is scanned once, avoiding repeated long-prefix comparisons.
Tests use finite 2- and 256-backtick runs, both with and without a valid closer;
no unbounded stress input is used.

## Focused verification

```sh
node --test --test-concurrency=1 --test-timeout=30000 \
  tests/sanitizer-issue-151.test.js \
  tests/sanitizer-issue-142-context.test.js \
  tests/sanitizer-issue-142-config.test.js \
  tests/sanitizer-issue-142-shapes.test.js \
  tests/sanitizer-issue-142-encoding.test.js \
  tests/sanitizer-issue-148.test.js
```

All 61 focused checks pass on Node.js 26.13.0. Changed JavaScript is checked
with ESLint (zero warnings) and all changed files with Prettier. The existing
CI supplies full Node/Bun/Deno platform suites, security and application checks.
