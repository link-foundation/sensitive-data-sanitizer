# Issues 181, 182 and 184: requirements and investigation

This branch implements both native sub-issues of [issue 184](https://github.com/link-foundation/sensitive-data-sanitizer/issues/184)
in [PR 185](https://github.com/link-foundation/sensitive-data-sanitizer/pull/185).
All three issue bodies, comments, and the PR's conversation, inline comments and
reviews were checked. There are no additional comments or nested sub-issues.

## Requirement inventory and plan

| Requirement                                                   | Implementation plan                                                                               | Verification plan                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 181: keep the quoted hive-mind release-note example unchanged | Bound Authorization values before literal trailing backticks inside a recognized code span        | Regression with the exact example, no findings, unchanged output                                                   |
| 181: support any opening backtick-run length                  | Reuse the bounded Markdown scanner; distinguish matching outer delimiters from literal inner runs | Single/double/triple/long delimiters and shorter literal runs                                                      |
| 181: apply existing placeholder rules                         | Preserve complete angle-bracket, variable and redaction placeholders                              | Schemes, Proxy-Authorization, masks, repeated passes                                                               |
| 181: preserve real credential detection and backticks         | Narrow the Authorization parser only; keep literal material within a credential sensitive         | Vendor/generic tokens, auth parameters, finding offsets, glued suffixes, malformed/unmatched spans and bare values |
| 181: cover the entire codebase                                | Fix shared parsing used by both Authorization and contextual rules                                | Sync credentials entry, full async sanitizer, streaming and CLI checks                                             |
| 182: remove single-sample timing flakiness                    | Warm up both sizes, interleave five samples, compare medians                                      | Deterministic outlier fixtures and actual Bun interpreter measurements                                             |
| 182: retain detection of quadratic lookbehinds                | Keep a threshold between linear and quadratic scaling; validate against the original regex shapes | Bounded old/new comparison, all three prefixes, no skipped Bun check                                               |
| 182: keep CI bounded and diagnostic                           | Retain child/test/job hang guards; report prefixes, samples and ratios on failure                 | Focused Bun test and current-commit macOS Intel CI                                                                 |
| 184: implement both sub-issues in one PR, without deferral    | Commit each useful atomic change on the prepared branch                                           | Review complete PR diff, clean working tree, current main ancestor                                                 |
| 184: close every issue on merge                               | Include separate `Fixes #184`, `Fixes #181`, `Fixes #182` references                              | Inspect final PR description                                                                                       |
| Release preparation and contribution rules                    | Add a patch changeset; use existing test-anywhere and CI                                          | Changeset validation, focused tests, lint/format, all current-commit CI checks                                     |

## Research and possible solutions

### Authorization placeholders

[CommonMark code spans](https://spec.commonmark.org/0.31.2/#code-spans) use
matching delimiter-run lengths. Shorter backtick runs inside a span are literal
content. The existing `markdownEnd` therefore correctly finds the outer closing
delimiter, but the Authorization value still contains the literal inner run.
The placeholder matcher then sees a template plus literal material.

Options considered:

1. Strip trailing backticks only for placeholder matching. This preserves literal
   backticks in real credentials, but requires exemptions to be consistent across
   overlapping detectors and auth-param values.
2. End Authorization values at a backtick inside a recognized span, as suggested
   in issue 181. This shares the existing boundary logic and preserves the
   backticks for both placeholders and real credentials. Keep assignment parsing
   strict and require a recognized matching outer span.
3. Use [micromark](https://github.com/micromark/micromark) or
   [markdown-it](https://github.com/markdown-it/markdown-it) to parse all Markdown.
   Both implement CommonMark, but a document parser adds dependencies and cost
   to a synchronous log sanitizer. The existing bounded scanner suits this fix.

The implementation narrows option 2 further: only the trailing backtick run is
removed from the detected value, and only when `markdownEnd` recognizes a
matching enclosing span. A backtick embedded within a credential remains part
of the credential. Both token values and unquoted auth-param values share this
rule; assignments retain their stricter boundaries. PR 179 provides the shared
parsing and regression-test conventions; PR 183 provides boundary-preservation
checks. The downstream workaround was also inspected in
[hive-mind's sanitizer](https://github.com/link-assistant/hive-mind/blob/main/src/sensitive-data-sanitizer.lib.mjs).

### JavaScriptCore timing

Saved original failure: `ci-logs/issue-182-original-job.log`, lines 917–931,
from run 43406123201 attempt 1, job 131821226566. The ratio was
7.208836240399472 against a bound of 7; the four sibling 60,000-tab checks passed.

Options considered:

1. Warm up and use five samples per size, comparing medians for the existing
   4,000/16,000 sizes with a bound of 8 (the geometric midpoint of 4 and 16).
2. Use 4,000/32,000 sizes and a bound of 20, also with warm-up and medians.
   Greater separation costs more interpreter time on the slowest CI runner.
3. Retry once, or use a benchmark framework such as
   [Tinybench](https://github.com/tinylibs/tinybench), which provides warm-up and
   repeated measurements. A small fixed sample set is sufficient here and avoids
   a dependency and adaptive benchmark duration.

Option 1 minimizes CI cost. Interleaving sizes reduces drift and preserves all
three adversarial prefixes. Each prefix has its own 25-second child hang guard
within the existing 30-second per-test guard, so sampling does not multiply one
test's deadline. Assertion failures include the prefix and all raw samples.
Bun uses
[JavaScriptCore](https://bun.sh/reference/bun/jsc); the existing child process
forces its regex interpreter with `BUN_JSC_useRegExpJIT=0`.

The bounded `jsc-growth.mjs` experiment uses the same sampling helper to compare
the current sanitizer with all three historical lookbehind shapes from
`e804ee5^`. The regex tails are shortened after the expensive lookbehind because
the adversarial input ends in `x` and cannot match those tails. Inputs are fixed
at 4,000 and 16,000 tabs, with no load-generating workers. Run with a finite
8 MiB stack and Bun's reduced-memory mode:

```sh
(ulimit -s 8192; BUN_JSC_useRegExpJIT=0 bun --smol experiments/issue-184/jsc-growth.mjs)
```

## Work checklist

- [x] Read complete scope, discussion and recent related PRs.
- [x] Check original failure logs and research existing components.
- [x] Reproduce the placeholder bug and capture pre-fix regression results.
- [x] Draft shared parser fix, robust timing check, regression coverage and docs.
- [x] Verify focused tests and bounded linear/quadratic experiment.
- [x] Format and lint changed files.

Release gates: validate the patch changeset against the committed diff; push
atomic commits; inspect the complete PR diff; verify CI on the latest SHA;
refresh all discussion; preserve all three closing references; mark PR ready.
The [PR description and checks](https://github.com/link-foundation/sensitive-data-sanitizer/pull/185)
record completion of those gates.

## Verification evidence

- `reproduce.mjs` prints the exact before/after example and synthetic real tokens.
  Three preservation regressions failed against the original parser: templates,
  literal-backtick preservation, and streaming. All 16 tests in
  `tests/sanitizer-issue-177.test.js` pass with the fix on Node and Bun.
- The placeholder matrix covers both headers, five scheme choices, four
  placeholder forms and four outer/inner delimiter combinations (up to 256
  backticks). It verifies no findings and unchanged sync/async output.
- Real credentials, embedded backticks, glued suffixes, malformed/escaped spans,
  known secrets, auth parameters and repeated sanitization retain detection.
  Default full mode retains personal-data detection; the async credentials-only
  mode also verifies precise auth-param redaction.
- Every split of a two-line placeholder/real-token input produces the same
  streamed output. Whole-input and streamed CLI redaction agree.
- The three actual Bun interpreter checks pass with five interleaved samples
  per size and both sizes warmed up. Deterministic fixtures check cold-start
  cost, one paused or unusually fast sample, and quadratic scaling with noise.
- ESLint reports zero warnings for changed JavaScript; Secretlint and Prettier
  pass. Full platform/runtime, security, example-app and documentation checks
  are delegated to existing CI to avoid duplicating resource-heavy builds.

Measured locally with `jsc-growth.mjs` (ratios of median long/short durations):

| Prefix    | Current sanitizer | Original lookbehind | Required bound |
| --------- | ----------------: | ------------------: | -------------: |
| `30`      |             4.008 |              16.300 |            < 8 |
| `a,`      |             3.980 |              15.530 |            < 8 |
| `Dear Ms` |             4.008 |              15.068 |            < 8 |

All current measurements pass and all three original shapes fail the same
criterion. Measurements are evidence of regression sensitivity, not a promise
of fixed wall-clock performance on every machine. No new dependency, CI timeout
increase, runtime skip, load generator or public API change is introduced.
