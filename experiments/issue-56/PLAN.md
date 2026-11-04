# Repository issue 56 work plan

Objective: fully implement issues 54 and 55 in PR 57, with one closing keyword
per issue (54, 55, 56). No native sub-issues or comments exist on 54 or 55 at
the initial read on 2026-11-04. All three PR comment endpoints were empty.

## Requirements and implementation/verification plan

| ID  | Requirement                                                                          | Proposed solution and verification                                                                                                           |
| --- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Typed placeholders for every personal finding, numbered per type by first appearance | Shared transformation registry; assert Person, Email, Phone, Organization, Education, Location and Date outputs                              |
| P2  | Same entity across fields, records, files and reused runs                            | Reusable private map and engine registry; cross-file and JSONL tests                                                                         |
| P3  | Configurable formats, including all three proposed spellings                         | Validated template with type/case/number fields; test default, square and brace forms                                                        |
| P4  | Reject formats that collide with existing input                                      | Check the complete token namespace before replacement, including reused maps; adversarial collision tests                                    |
| P5  | Return or write private restore map in JSON and Links Notation                       | Versioned map schema, official links-notation parser/formatter; equivalent deserialization tests                                             |
| P6  | Map files 0600, separate from sanitized output, rejected by publication checks       | Existing atomic private writer, path separation and content marker rejection in inspect/sanitize/CLI/stream; permissions and rejection tests |
| P7  | Reuse existing map, preserve IDs, allocate next free ID                              | Validate maps and index existing entries; continued numbering and malformed map tests                                                        |
| P8  | API restore and CLI restore, including derived model answers                         | Exact occurrence metadata for original document and canonical fallback for derived text; tests for both                                      |
| P9  | No-map full anonymization, no returned/written map, residual verification            | map:false registry without retained surfaces/documents, normal verification; test output and absence of map                                  |
| P10 | Name initials, surname, transliterations and Russian inflections share identity      | Reuse nameAliases and component canonicalization, conservative unique alias linking; exact surface round trips and ambiguous surname tests   |
| P11 | Exact free-text, JSON and JSONL round trips, including keys                          | Store replacement occurrences without original full document; preserve escaped surfaces and valid JSON; fixture tests                        |
| P12 | Credentials redacted and excluded from map by default; explicit opt-in               | Credential gate before placeholder rendering; test secret exclusion and opted-in restoration                                                 |
| P13 | Clearly document that maps contain personal data and detection limits still apply    | API, README, coverage and runnable example                                                                                                   |
| D1  | Legal-form organizations, both orders, quoted/unquoted, supported locales            | Bounded locale vocabulary and proper-name recognizers; per-locale list fixtures and order tests                                              |
| D2  | Educational institutions with adjacent proper names                                  | Bounded type-word rules; per-locale fixtures                                                                                                 |
| D3  | Bounded city/region gazetteer plus location labels                                   | Small authored offline place vocabulary and bounded label rules; locale/city/region tests                                                    |
| D4  | ORGANIZATION, EDUCATION, LOCATION usable by placeholder and fake modes               | Typed findings and existing fake fallback; transformation tests                                                                              |
| D5  | publicEntities exemptions and knownPersonal forced removal                           | Existing review policy for new types, also structured input; override tests                                                                  |
| D6  | Lower confidence and explicit profile switch                                         | New documents profile and documentEntities option; metadata and threshold tests                                                              |
| D7  | Default credential/log behavior unchanged                                            | New recognizers disabled under existing profiles; existing focused credential/session tests and CI                                           |
| D8  | COVERAGE.md new types and limits                                                     | Document finite vocabulary, heuristic errors, locale coverage and opt-in                                                                     |
| W1  | Entire codebase, single PR, release preparation                                      | Audit sync/async, CLI, structured, stream/worker, exports/types; minor changeset                                                             |
| W2  | Finalize branch and PR, review all diffs and current-head CI                         | Merge origin/main, atomic commits/push only prepared branch, update description, inspect logs, mark ready                                    |

## Work stages

- [x] Read parent, both sub-issues and every PR comment/review endpoint.
- [x] Read contributing guide and existing transformation/detection/identity paths.
- [x] Research reusable components and record root causes/alternatives.
- [x] Capture baseline reproduction with a finite experiment.
- [x] Draft implementations, tests, public API/types, CLI, docs and changeset.
- [x] Run focused regression and adjacent checks; correct failures.
- [x] Commit and push atomic changes; review PR diff and current-head CI.
- [x] Recheck feedback, clean tree, base merge and PR readiness.

## Design decisions

Exact restoration of several surface forms from a single identical token is
information-theoretically ambiguous without occurrence information. The map
therefore stores private replacement positions keyed by the sanitized document
digest. Derived text uses the first full/canonical surface. Credentials are
irrecoverable unless explicitly opted into the map. No original full document
is stored. A map is personal data, not an anonymized artifact.

Existing template case study docs/case-studies/issue-56 refers to a different
repository; preserve it and put this investigation in issue-56-placeholders.

## Implementation and evidence index

- P1–P4, P7, P10: `src/placeholders.js`, `src/transforms.js` and
  `tests/sanitizer-placeholders.test.js` cover numbering, shared identities,
  formats, reused maps, Russian forms and transliterations.
  `tests/sanitizer-placeholder-escaping.test.js` additionally covers complete
  JSON namespace checks, a bounded adversarial string and custom type collisions.
- P5, P6, P8, P11, P12: `src/restore-map.js`, `bin/placeholders.js`, structured
  projection and the placeholder/CLI suites cover both map formats, exact and
  derived restoration, private writes, publication rejection, credential policy,
  structured keys, caller-owned file maps and complete multi-batch streams.
- P9: the placeholder suite verifies discarded state in sync/async no-map
  operations and an external detector that rejects a residual in the real output.
  Existing stream cleanup also discards the no-map registry after completion.
- D1–D7: `src/document-entities.js`, `src/document-vocabulary.js`, policy/fake
  integration and `tests/sanitizer-document-entities.test.js` cover every locale,
  both legal-form orders, city/region and label detection, confidence/off switches,
  public exemptions and private overrides. Existing credential/log suites and
  session publication CI cover default behavior.
- P13, D8, W1: README, API and COVERAGE document map sensitivity and finite
  detection/linking limits; `src/index.js`/`src/index.d.ts`, the packaged runnable
  example and minor changeset cover public integration and release preparation.

All 55 new focused checks pass in Node, Bun and Deno. Node/Bun exercise private
filesystem cases; Deno uses the existing write-permission gate. Six package
metadata checks, 85 adjacent transformation/fake/credential/JSONL checks and 21
public-policy/JSON/residual checks pass. `npm pack --dry-run --json` confirms the
new runtime modules and example are published. Full CI evidence and final branch
checks are recorded in the linked investigation and PR.

The implementation at `298706e` passed the complete nine-job runtime matrix in
[run 41811037940](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/41811037940).
Security (including both CodeQL analyses), example app and link workflows also
passed. CodeQL alert 7 reports the JSON scanner finding as fixed. The latest main
is already an ancestor; all issue/PR comment endpoints and both child-issue lists
were checked again, with no additional requirements. PR 57 is ready for review.
This final documentation update records the evidence without changing runtime
code; its current-head checks are verified separately before handoff.
