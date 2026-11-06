# Issues 104–106: requirements, research and verification plan

Scope: [parent #106](https://github.com/link-foundation/sensitive-data-sanitizer/issues/106),
[#104](https://github.com/link-foundation/sensitive-data-sanitizer/issues/104), its
[complete follow-up](https://github.com/link-foundation/sensitive-data-sanitizer/issues/104#issuecomment-6676991784),
and [#105](https://github.com/link-foundation/sensitive-data-sanitizer/issues/105).
The initial PR has no conversation comments, inline comments or reviews. Neither
child has further sub-issues. All examples use synthetic data.

## Requirement inventory and implementation plan

| Requirement                                                                                                                    | Alternatives and selected plan                                                                                                                                                | Verification                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 104.1: all nine dated-title rows, including comma/suffix, nested parentheses, slash employers, multiple roles and B2B titles   | Expanding a job dictionary cannot cover arbitrary titles. Scan date anchors and partition the preceding entry structurally; retain a capitalized/quoted employer requirement. | Every reported row in text and JSON, plus unrelated unseen titles.                          |
| 104.2: all six lead-in rows, including arbitrary prefixes and successive entries                                               | A single start-of-line regexp misses later entries. Advance between date anchors and line/entry separators.                                                                   | Exact text/JSON outputs, two employers on one line.                                         |
| 104.3: industry pipes, multiword employers, group names with/without titles                                                    | Parse the employer before the industry pipe; recognize group legal cues independently.                                                                                        | All four reported rows, preserve industry text.                                             |
| 104.4: three Russian comma mobiles and two English follow-up rows                                                              | Reuse the domestic mobile shape with comma context; avoid global bare-number matching.                                                                                        | Text/JSON replacement and `order`/`id` controls.                                            |
| 104.5: four school forms                                                                                                       | Documented limits are permitted; implement bounded acronym/bracket and education-label cues.                                                                                  | Four exact text/JSON cases.                                                                 |
| 104.6: six technology over-redactions and release/Kubernetes follow-up                                                         | An unlimited allowlist is unsound. Preserve a small explicit set under weak company/duration/date cues; explicit private declarations remain authoritative.                   | All seven examples and ordinary organization controls.                                      |
| 104.7: long-line cost                                                                                                          | Avoid repeated prefix searches and compile fixed expressions once. Measure finite 267-byte/9-KB and hostile inputs; no absolute hardware-dependent promise.                   | Bounded benchmark and focused performance probe.                                            |
| 104.8: eight unchanged rows                                                                                                    | Lowercase employers are indistinguishable from the meeting control. Keep lowercase dated employers and document that permitted limit in COVERAGE.                             | All eight controls and all three lowercase examples.                                        |
| 104.9: English parity                                                                                                          | Structural parser shared by scripts, no new job-title vocabulary.                                                                                                             | Both English dated examples and additional titles.                                          |
| 104.10: group cues and list continuations                                                                                      | Add `ГК` / `группа компаний` and finite continuation grammar, including `потом в`.                                                                                            | Both group examples and complete inflected list.                                            |
| 104.11: `/d/<id>` links at any host/id length                                                                                  | Detect the path shape rather than an opaque-id minimum; keep ordinary roots.                                                                                                  | Both short-id examples plus one-character id, text/JSON.                                    |
| 104.12: relative `location` path                                                                                               | Reuse operational path policy and recognize relative path syntax.                                                                                                             | `apps/api` preserved, real locations and personal paths protected.                          |
| 104.13: caller-sensitive field spelling                                                                                        | Normalize custom names like built-in names (case, underscores, hyphens), retaining complete-value replacement.                                                                | All three reported spellings, nested primitives/containers, sync/async.                     |
| 104.14: no-cue prose                                                                                                           | Separate opt-in request 105; do not silently broaden default document output.                                                                                                 | Default preservation and opt-in tests.                                                      |
| 105.1: `properNames: 'capitalized'`, off by default                                                                            | Native structural scanner instead of NLP models; reuse existing detection/mapping pipeline.                                                                                   | Configuration validation and default behavior.                                              |
| 105.2: activate independently per string for selected script letters, parenthesized date range, comma mobile or `/d/<id>` link | Default scripts to Cyrillic for the reported operational-English use case; expose `scripts` with validated Unicode Script names, allow `[]`.                                  | Each trigger and non-trigger in isolated and mixed JSON values.                             |
| 105.3: uppercase anywhere, joined words, typographic quotes, links (including bare domains/paths), bare mobiles                | Advance through maximal tokens once, then classify; never restart a greedy regexp at each suffix.                                                                             | Mixed-case, hyphen/dot joins, quotes, URL and phone fixtures.                               |
| 105.4: preserve labels, lowercase, numbers/dates, paths, keys, untriggered values                                              | Skip existing markers, classify labels/paths before proper words; scope to decoded JSON values and preserve exact source offsets.                                             | All seven expected rows, listed known limits, Unicode/escaped keys, nested JSON/JSONL.      |
| 105.5: idempotence                                                                                                             | Exclude markers; structural findings do not seed document-wide propagation.                                                                                                   | Second redaction equals first; reusable typed maps restore and repeat original inputs.      |
| 105.6: valid JSON with identical keys/numbers                                                                                  | Reuse decoded-value/source-offset mapping; no parse/reserialize of output.                                                                                                    | Escaped strings, nested containers, JSONL, sync/async/CLI/worker paths.                     |
| 105.7: linear new scanner cost, including long unspaced tokens                                                                 | Fixed-pass tokenization and constant-size per-token classification; bounded resource probe.                                                                                   | Finite increasing input sizes, long dotted/hyphenated/nonmatching tokens.                   |
| 106: single PR, all scope and independent closing keywords                                                                     | Update PR 107, add release Changeset, integrate current main, inspect final diff and wait for current-SHA CI.                                                                 | Clean tree, pushed commits, ready PR, all checks, `Fixes #106`, `Fixes #104`, `Fixes #105`. |

## Online research and component choices

- [ECMAScript Unicode matching semantics](https://tc39.es/ecma262/multipage/text-processing.html#sec-runtime-semantics-unicodematchpropertyvalue-p)
  and [Unicode Script specification](https://unicode.org/reports/tr24/): native
  Unicode properties support structural uppercase/script detection without name
  dictionaries. Validate script aliases using the runtime rather than accepting
  arbitrary regexp syntax. A script is not a language.
- [libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js) already
  provides phone parsing in this repository. Assignment validation is different
  from the requested synthetic mobile shape; comma context is still necessary to
  avoid order/id false positives. No new phone dependency is needed.
- [linkify-it](https://github.com/markdown-it/linkify-it) offers Unicode link
  recognition including fuzzy URLs. It is an option for broader future URL
  grammar. This request needs a small deterministic token classifier, avoiding
  an added runtime dependency and its independent matching-cost assumptions.
- [Compromise](https://github.com/spencermountain/compromise) provides an English
  grammar baseline and entity tagging. Its lexicons do not implement the requested
  script-independent, deliberately aggressive uppercase rule.
- [Presidio](https://microsoft.github.io/presidio/) combines NLP, patterns and
  custom recognizers. The existing optional bridge remains useful for callers
  wanting linguistic entities; model/runtime requirements do not fit this native,
  synchronous, offline structural option. No models or additional packages are
  needed for these changes.

## Work and verification checklist

- [x] Read complete parent/child issues, all comments, PR comments and reviews.
- [x] Research alternatives and inventory every prose/acceptance requirement.
- [x] Draft regression coverage and demonstrate baseline failures.
- [x] Implement all requirements and public option/type/documentation surfaces.
- [x] Run focused regressions and bounded probes; review compatibility.
- [x] Commit release fragment and implementation; push only the prepared branch.
- [x] Update PR description, inspect diff and integrate latest main.
- [x] Verify all implementation-commit CI, ready PR and clean tree; final head checks remain visible on PR 107.

## Implementation and local evidence

`document-experience.js` replaces the role-gated complex-entry parser with a
forward date-anchor scan. The previous non-parenthesized and pipe layouts remain
covered. `proper-names.js` performs optional script/shape gating, quote scanning
and maximal-token classification. Date grammar is shared in `document-dates.js`.
`structured.js` maps findings through escapes and nested serialized containers;
synchronous and asynchronous engines use the same independently scoped views.
The CLI, worker options, TypeScript declarations and API all expose the option.

The first new regression run on the original source produced **79 failures out
of 95 cases**, covering both missed document forms and the rejected new option.
The fixed focused suite additionally covers existing issue-100 document rules,
experience layouts, profiles and reversible placeholders. Integration coverage
checks CLI flags/config, split JSONL streaming, the bounded file worker, exact
Unicode escape mapping, nested serialized JSON keys, month-name date ranges,
restoration and stable map reuse. Existing placeholder collision protection is
retained; already-tokenized placeholder input remains rejected by that mode.

Reproduce the focused checks:

```sh
node --max-old-space-size=384 --test --test-timeout=30000 tests/package-metadata.test.js tests/sanitizer-issue-106.test.js tests/sanitizer-prose-integration.test.js tests/sanitizer-experience-lines.test.js tests/sanitizer-issue-100.test.js tests/sanitizer-placeholders.test.js tests/sanitizer-profiles.test.js
node_modules/.bin/eslint . --max-warnings 0
```

The focused selection passes all **260 tests**, including package metadata. The compatibility regression also
checks that Chinese and Arabic document entities remain protected alongside
activated uppercase prose. Nonoverlapping existing document findings are retained.

The finite probe in `experiments/issue-106/prose-cost.mjs` tests seven hostile shapes
at 50K, 100K and 200K characters: unspaced lowercase, dotted, hyphenated, an
unclosed quote, a slash run, a long interior dot run and a long tab suffix. The automated integration
check forks it with a **128 MiB heap, 1 MiB stack and two-second matching limit**.
An illustrative Node 26 run measured 31/48/95 ms for the seven shapes at each size,
175 ms total. These measurements are evidence of bounded practical cost, not a
hardware-independent timing promise or formal proof of every surrounding rule.
The scanner strips punctuation by walking backward once; an end-anchored suffix
regexp could otherwise retry on each interior punctuation character.

`experiments/issue-106/document-cost.mjs` separately compares the complete
synchronous documents+JSON pipeline against a released checkout. Ten measured
iterations after three warmups gave:

| Synthetic unchanged JSON line | Original 0.17.1 | This branch |
| ----------------------------- | --------------- | ----------- |
| 267 bytes                     | 4.87 ms         | 4.76 ms     |
| 9,000 bytes                   | 19.89 ms        | 19.30 ms    |

This fixture shows no material whole-pipeline change. It does not reproduce the
private original workload or substantiate a universal speedup. The date-anchor
parser removes the old repeated lazy prefix matching, and the new prose rule
avoids restarting searches at token suffixes. Existing optional scanners may
have different cost. [V8's non-backtracking engine discussion](https://v8.dev/blog/non-backtracking-regexp)
explains why native JavaScript regexp use alone cannot establish a linear bound.
The bounded JSONL worker remains available for latency-sensitive callers.

Use `node --max-old-space-size=256 experiments/issue-106/document-cost.mjs`
and optionally append another checkout's `src/index.js` to reproduce this
comparison. The synthetic runnable example is `examples/prose-logs.mjs`.

The explicitly permitted lower-case ambiguity and finite technology/acronym
policies are documented in COVERAGE; they are deliberate supported limits.
No requested implementation is deferred to an external library or model.

## CI investigation

The first implementation commit, `f0016ea`, was tested by runs created on
2026-11-06 at 05:07:53 UTC. The logs were downloaded into the ignored `ci-logs/`
folder and inspected before changing code:

- [Checks and release run 42166557324](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42166557324)
  failed full lint: `checks-42166557324.log` lines 2118–2125 identified complexity
  16 (limit 15) in `loadOptions` and `personalValueAllowed`. Move CLI feature
  assignments into the existing feature helper and extract location-path
  classification; run full ESLint with zero warnings locally.
- [Security run 42166557443](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42166557443)
  reported one CodeQL `js/polynomial-redos` finding (log lines 7943–7957). The
  downloaded SARIF points to the whitespace label-suffix expression in
  `proper-names.js`. Replace it with an explicit forward whitespace scan and add
  the tab-run shape to the bounded automated probe.
- The same commit passed the example-app and broken-link workflows. These
  results do not substitute for checks of the final commit, tracked on PR 107.

The follow-up commit `eccb68e` passed full lint, security (including all CodeQL
languages), example-app builds and links. Its runtime matrix exposed a stale
exact package-file assertion after adding the runnable prose example:
`bun-127727417376.log` lines 3679–3686 and `deno-127727417238.log` lines 4077–4090.
Deno reported 3,011 passing tests and this single failure. Update the package
metadata fixture to include the new example; reproduce the failure and pass
locally with `node --test tests/package-metadata.test.js`. The focused suite also
checks the exact English phone examples, hyphen normalization and default-profile
relative location handling.

## Final verification

Implementation and regression commit `79282397eef50b74b2a51b45b3a53af6c35dab51`
passed every applicable CI job:

- [Checks and release, including Node/Bun/Deno on Linux/macOS/Windows, session corpus and Docker](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42167998894)
- [Security, CodeQL and dependency audits](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42167998946)
- [Example-app builds](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42167998884)
- [Broken-link check](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42167998878)

The branch includes the latest checked `main` (`27e7af5`). PR 107 is ready for
review and closes all three required issues. This final evidence update changes
only documentation; final-head checks are available on the PR. No acceptance
criterion is blocked or deferred.
