# Issue 203: issues 200, 201 and 202

Every name in these scripts and tests is made up.

| Script                 | What it shows                                                                    |
| ---------------------- | -------------------------------------------------------------------------------- |
| `short-windows.mjs`    | Issue 202: `knownOnly` `inspect()` on 4,000 windows of about 1.1 KB              |
| `markdown-records.mjs` | Issue 201: the reproduction of the issue (emphasis, list items, key/value table) |
| `markdown-timing.mjs`  | Issue 201: cost of the Markdown record shapes on 1 MB or larger inputs           |

`short-windows.mjs` and `markdown-timing.mjs` take the path of a `src/index.js`
as the first argument, so a worktree of another version can be measured with
the same script (`git worktree add --detach /tmp/v0230 v0.23.0`).

## Requirements

| Issue | Requirement                                                                                                                                                                                 | Change                                                                                                | Test                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| #200  | The 8 MiB issue 172 tests get a per-test bound that holds on the macOS Intel runners (90 s)                                                                                                 | `tests/helpers/long-test.js` (`itWithin`, `LONG_TEST_TIMEOUT`), used by `sanitizer-issue-172.test.js` | `issue 200: per-test bounds` in `tests/long-test.test.js`                                  |
| #200  | The other large-input tests near the 30 s bound on macOS Intel get the same bound: the 10 MiB bounded worker file (16–20 s, over 30 s on a slow runner) and the 7 MB JSONL record (12–21 s) | `itWithin` in `sanitizer-stream.test.js` and `sanitizer-jsonl-stream.test.js`                         | the tests themselves on the macOS Intel jobs                                               |
| #200  | Optional: retry a test job once when its only failure is a timeout                                                                                                                          | Not done, see below                                                                                   | —                                                                                          |
| #201  | Spans cover the value only and `sanitize()` keeps the emphasis                                                                                                                              | `unmarked` trims `*`, `_` and backticks from keys and values; `pairPattern` allows `**` after a key   | `reports the value without its emphasis…`                                                  |
| #201  | Consecutive list items with name keys form one record, ended by a blank line, a repeated key or a text line                                                                                 | `startsItem` and `separate(gap, items)` in `pairRecords`                                              | `joins name fields that are consecutive list items`                                        |
| #201  | Consecutive key/value table rows with a name key in the first cell form one record                                                                                                          | `fieldRows`                                                                                           | `joins the rows of a key/value table`                                                      |
| #202  | Build a derived view only when the text has what it handles; reuse the original when the view changes nothing                                                                               | `knownView` skips a view whose only changes are inert characters (`&amp;`, `&lt;`)                    | `does not build a decoded view that only turns &amp; into &`                               |
| #202  | Compute word starts once and cheaply                                                                                                                                                        | An anchor trie finds candidate positions; `isStart` tests a word start at those positions only        | `finds the same word starts as the start pattern`, `keeps the matches the anchors lead to` |
| #202  | Add a short-text case to the cost table                                                                                                                                                     | `docs/COVERAGE.md`, "Compiled known-value measurements"                                               | `short-windows.mjs`                                                                        |

### Retry on timeout (issue 200, optional)

`Rerun unacquired jobs` reruns jobs that never got a runner. Telling a timeout
from another failure would need it to download and parse each failed job's log.
A retry would also hide a real slowdown of the code under test. The per-test
bound fixes the cause: the 8 MiB tests check that a long run does not overflow
the stack, not how fast it is scanned, and the slowest run seen (35.5 s) is
well inside 90 s. `scripts/run-with-budget-warning.sh` still bounds the whole
suite.

## Library research

- Per-test timeouts: test-anywhere 0.9.1 `it(name, fn)` has no options.
  [`node:test`](https://nodejs.org/api/test.html#itname-options-fn) accepts
  `{ timeout }` per test, and
  [`bun:test`](https://bun.sh/docs/test/writing#timeouts) a third argument.
  Both override the global `--test-timeout` / `--timeout` flag.
- Multi-pattern search: Aho–Corasick libraries (`ahocorasick`,
  `@monyone/aho-corasick`) find many literals in one pass, but the anchors are
  at most four characters, so a plain trie walk from each anchor-start
  character is enough and keeps the package free of new dependencies.
- Markdown parsing: `marked` or `remark` would give list items and tables, but
  the matcher needs offsets in the raw text and works on any text, including
  Markdown inside logs, so line-based rules are used.

## Measurements

Node.js v26.13.0, Linux x64. `short-windows.mjs`, steady round, 0 findings:

| Version        | Round 0 | Round 1 | Round 2 |
| -------------- | ------- | ------- | ------- |
| 0.23.0         | 1501 ms | 1317 ms | 1327 ms |
| `main` fa8143b | 3297 ms | 2892 ms | 2916 ms |
| This branch    | 941 ms  | 708 ms  | 730 ms  |

1 MB inputs (`experiments/issue-198/view-timing.mjs`, `records-timing.mjs`,
`knownOnly: true`):

| Input                | `main` fa8143b | This branch |
| -------------------- | -------------- | ----------- |
| mixed Cyrillic/Latin | 456 ms         | 130 ms      |
| percent-encoded URLs | 786 ms         | 439 ms      |
| HTML references      | 1636 ms        | 935 ms      |
| prose with name keys | 214 ms         | 78 ms       |
| YAML records         | 937 ms         | 572 ms      |
| CSV records          | 874 ms         | 598 ms      |
| key/value lines      | 331 ms         | 229 ms      |

`markdown-timing.mjs`, 1 MB and 4 MB (record matching stays linear):

| Input                   | `main` 1 MB | This branch 1 MB | This branch 4 MB |
| ----------------------- | ----------- | ---------------- | ---------------- |
| bold keys               | 897 ms      | 579 ms           | 1941 ms          |
| list items              | 622 ms      | 384 ms           | 1720 ms          |
| key/value table         | 614 ms      | 708 ms           | 3101 ms          |
| list without name keys  | 228 ms      | 112 ms           | 461 ms           |
| table without name keys | 213 ms      | 49 ms            | 187 ms           |
