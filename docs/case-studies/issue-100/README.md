# Issues 100, 91 and 94: document sanitization gaps

## Scope and work plan

Read #100, its two native sub-issues (#91 and #94), all their comments, and
PR #101 conversation, inline comments and reviews. Neither child has further
sub-issues. There was no PR feedback when implementation started. All work lands
in PR #101. Every child and parent needs its own positive closing reference.

Plan and verification checklist:

- [x] Inventory every reported form, later comment, preservation control and release requirement.
- [x] Research decoding, phone parsing and extensible entity recognizers.
- [x] Reproduce root causes with small serial experiments.
- [x] Implement shared native/structured detection and synchronous schema declarations.
- [x] Add regressions for every changed row and accepted ambiguous limit.
      Final verification gates: review CI for the latest SHA, update PR title/body,
      ensure current main is merged, preserve commits and mark ready. The live checks
      and review state are recorded on [PR #101](https://github.com/link-foundation/sensitive-data-sanitizer/pull/101).

## Root causes, alternatives and selected solutions

| Requirement                                | Root cause                                                                                                                 | Alternatives and selected implementation                                                                                                                                                                        | Verification                                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Percent-encoded email/phone queries        | Encoded-run scanning discards the query label; standalone values can lack the context needed for automatic classification  | Decode and reserialize entire URLs, or decode bounded values while retaining labels. Choose the latter to preserve unaffected bytes, including access-log syntax                                                | Plain/encoded absolute and relative URL cases in `sanitizer-issue-100.test.js`                                   |
| Personal paths under arbitrary labels/text | Existing operational-value policy only elevates paths under the `url` label                                                | Document a limit or apply the path grammar to content. Choose shared document content detection                                                                                                                 | `/profile/` and `/users/` in text and under `url`, `link`, `target`                                              |
| Education Cyrillic acronym                 | English label only accepted Latin letters                                                                                  | Add a separate rule or broaden to Unicode letters. Choose Unicode                                                                                                                                               | `Education: МГУ` in both modes                                                                                   |
| Empty children attribute followed by lines | Raw JSON rule swallowed escaped newline and following content                                                              | Suppress raw scanning entirely or stop document labels at escape boundaries while retaining decoded views. Choose the latter                                                                                    | Exact `Дети: нет\nуровень: info` preservation                                                                    |
| Complex CV entries                         | Existing grammar restricts title/employer punctuation, range ends and entry starts                                         | Replace all CV parsing or supplement bounded date anchors with title cues. Choose supplementary parsing and reuse the existing date vocabulary                                                                  | All 13 dated rows below, existing experience-line suite, hostile-line checks                                     |
| Multi-word employer labels                 | Capture ended after one word                                                                                               | Expand bounded value capture to comma/line/escape/quote boundary                                                                                                                                                | All five labels, exact outputs in both modes                                                                     |
| Structured field aliases                   | Label catalogs have inconsistent spelling and value grammars                                                               | Broaden all generic labels or add an explicit document schema vocabulary. Choose the latter; normalize case, `_`, `-` consistently                                                                              | All 21 reported fields, synchronous/asynchronous checks                                                          |
| Caller-declared sensitive fields           | No synchronous schema override                                                                                             | Synchronous detector callbacks or explicit property declarations. Add `sensitiveFields` for complete values at any depth, including containers/primitives; retain exact property spelling and source whitespace | String/empty/number/boolean/null/object/array, JSON/JSONL, nested properties, invalid configuration, idempotence |
| Phone cues and bare mobiles                | Existing phone contexts omit `контакт` and some compact forms                                                              | Redact every 11-digit number or require a cue/complete mobile-only line. Choose cue or complete-line `79…`/`89…` shape                                                                                          | Three positives and `order`/`id` controls                                                                        |
| Opaque share URLs                          | No generic capability-link shape rule                                                                                      | Host allowlist, generic opaque segments or document a limit. Choose bounded generic 24–128-character segments, documenting possible public-link false positives                                                 | All three supplied share URLs; documentation/root controls                                                       |
| Personal root website                      | Personal ownership cannot be inferred from a root                                                                          | Guess from domain names or explicitly document ambiguity. Choose the permitted documented limit                                                                                                                 | Exact root website preservation                                                                                  |
| Split signature, school verb, role labels  | Missing line separator/verb/label forms                                                                                    | Extend existing introduction/school rules and add bounded explicit role labels                                                                                                                                  | All four smaller forms                                                                                           |
| Doubly escaped structured fragment         | Mapped fragment loses detecting context when decoded; recursive replacement returns identical bytes until residual failure | Drop record, redact whole record, or replace a no-progress fragment. Choose fragment replacement in synchronous/asynchronous rendering                                                                          | Exact issue fragment stays parseable and removes organization, surrounding metadata retained                     |
| Free-text companies from later comment     | Missing multi-word/list/duration cues                                                                                      | NLP or bounded contextual rules. Choose finite cues and capitalized lists/durations without model downloads                                                                                                     | All six previously missed rows plus existing employment rules and both controls                                  |
| Synchronous custom values/detection        | `detectors` are asynchronous-engine callbacks                                                                              | Add a second callback API or document/use existing synchronous `knownPersonal` values and precomputed `findings`. Choose existing value-list API, satisfying the comment's explicit alternative                 | `Lyutik работал` with a synchronous known-value list                                                             |
| Publication containing #90                 | Original report was stale                                                                                                  | Republish or verify the existing release. Reporter confirms 0.16.2; npm metadata and GitHub release confirm publication                                                                                         | npm 0.16.2 integrity and GitHub release published 2026-11-05 18:13:10 UTC                                        |
| Next release preparation                   | User-facing feature/bug changes require release metadata                                                                   | Manual version bump or Changesets. Follow repository policy with one minor changeset                                                                                                                            | Changeset guard and release CI                                                                                   |
| Single PR and complete closure             | Parent aggregates both children                                                                                            | Keep all changes together and repeat `Fixes` for #100, #91 and #94                                                                                                                                              | PR description and clean branch review                                                                           |

Synchronous detector callbacks remain unsupported by `sanitize`; this limitation
is explicit in API/COVERAGE. Callers already have a synchronous custom-value list
and exact-input findings, so no asynchronous callback is silently executed in a
synchronous function. The four ambiguous undated/site examples are accepted
coverage limits, not deferred implementation. Numeric fields outside explicit
`sensitiveFields` retain the existing primitive policy.

## Research and existing components

- The [WHATWG URL Standard](https://url.spec.whatwg.org/#percent-encoded-bytes)
  defines percent bytes and decoding. Native `decodeURIComponent` already
  supplies strict UTF-8 decoding; replacing bounded query values avoids URL
  normalization changing unrelated bytes. This is an implementation inference
  from the standard and the byte-preservation requirement.
- [libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js)
  provides phone parsing/matching and is already a dependency. It cannot infer
  whether an arbitrary compact integer is an order ID or phone. Explicit
  context remains necessary for the supplied controls; no additional library
  is needed for these finite mobile shapes.
- [Presidio Analyzer](https://microsoft.github.io/presidio/analyzer/) supports
  pattern, custom and model-based recognizers with offsets. The repository
  already has a Presidio bridge. It can extend broader language/entity
  coverage, but adding Python/models to synchronous native log hooks would add
  resource costs and would not replace explicit schema policy.
- [Google Drive resource keys](https://developers.google.com/workspace/drive/api/guides/resource-keys)
  document link-shared file access and additional keys. An opaque path does
  not establish public/private permissions; treating it as potentially
  sensitive is a conservative heuristic, not a permission check.
- Recent related merged PRs reviewed: #90 (document context/cost), #85
  (identifiers and structured value views), #76 (labelled experience lines),
  #93 (release integrity), #96 (CI tooling). Reuse their shared scanners,
  source-offset mappings, `test-anywhere`, and Changesets workflow.

No new dependencies, runtime model downloads or network lookups were added.

## Complete reported-row inventory

All new regression cases live in `tests/sanitizer-issue-100.test.js`; existing
experience/document/structured regression suites protect previous coverage.
Each text row is checked both directly and in a structured `note` string.
The table includes already-working reference examples where explicitly given.

### Issue 91

| Section               | Reported input/field                                                        | Policy / evidence           |
| --------------------- | --------------------------------------------------------------------------- | --------------------------- |
| Reproduction (0.16.1) | `json({ link: 'https://example.org/p?email=anna.smirnova@example.org' })`   | Redact; regression coverage |
| Reproduction (0.16.1) | `json({ link: 'https://example.org/p?email=anna.smirnova%40example.org' })` | Redact; regression coverage |
| Reproduction (0.16.1) | `json({ link: 'https://example.org/p?phone=+79161234567' })`                | Redact; regression coverage |
| Reproduction (0.16.1) | `json({ link: 'https://example.org/p?phone=%2B79161234567' })`              | Redact; regression coverage |
| Reproduction (0.16.1) | `json({ target: '/login?email=anna.smirnova%40example.org' })`              | Redact; regression coverage |
| Reproduction (0.16.1) | `text('GET /login?email=anna.smirnova%40example.org 200')`                  | Redact; regression coverage |
| Reproduction (0.16.1) | `json({ link: 'https://example.org/profile/abc123def' })`                   | Redact; regression coverage |
| Reproduction (0.16.1) | `json({ link: 'https://example.org/users/abc123def' })`                     | Redact; regression coverage |
| comment               | `text('Education: МГУ')`                                                    | Redact; regression coverage |
| comment               | `json({ note: 'Дети: нет\nуровень: info' })`                                | Redact; regression coverage |

### Issue 94

| Section                                              | Reported input/field                                                                           | Policy / evidence                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1. CV experience lines still keep the employer       | `Директор, руководитель отдела, Ромашка (2019 – 2021)`                                         | Redact; regression coverage           |
| 1. CV experience lines still keep the employer       | `Директор (продажи), Ромашка (2019 – 2021)`                                                    | Redact; regression coverage           |
| 1. CV experience lines still keep the employer       | `Менеджер / руководитель, Ромашка (2019 – 2021)`                                               | Redact; regression coverage           |
| 1. CV experience lines still keep the employer       | `Менеджер, ГК «Ромашка» (2019 – 2021)`                                                         | Redact; regression coverage           |
| 1. CV experience lines still keep the employer       | `Менеджер, Ромашка, ООО (2019 – 2021)`                                                         | Redact; regression coverage           |
| 1. CV experience lines still keep the employer       | `Менеджер, Ромашка, Москва (2019 – 2021)`                                                      | Redact; regression coverage           |
| 1. CV experience lines still keep the employer       | `Менеджер, Ромашка (Москва) (2019 – 2021)`                                                     | Redact; regression coverage           |
| 1. CV experience lines still keep the employer       | `Менеджер, Ромашка (2019-01-01 — )`                                                            | Redact; regression coverage           |
| 1. CV experience lines still keep the employer       | `Менеджер, Ромашка (2019-01-01 — null)`                                                        | Redact; regression coverage           |
| 1. CV experience lines still keep the employer       | `Менеджер, Ромашка (2019 – 2021); Директор, Лютик (2021 – 2023)`                               | Redact; regression coverage           |
| 1. CV experience lines still keep the employer       | `Менеджер, Ромашка (2019 – 2021), Директор, Лютик (2021 – 2023)`                               | Redact; regression coverage           |
| 1. CV experience lines still keep the employer       | `Ромашка, менеджер (2019-01-01 — 2021-05-31)`                                                  | Redact; regression coverage           |
| 1. CV experience lines still keep the employer       | `Менеджер &#124; Ромашка &#124; 2019-01-01 — 2021-05-31`                                       | Redact; regression coverage           |
| 1. CV experience lines still keep the employer       | `Менеджер, Ромашка Лютик`                                                                      | Documented ambiguous limit; preserved |
| 1. CV experience lines still keep the employer       | `- Ромашка Лютик 5 лет`                                                                        | Documented ambiguous limit; preserved |
| 1. CV experience lines still keep the employer       | `Последнее место работы Ромашка Лютик`                                                         | Documented ambiguous limit; preserved |
| 2. A label replaces only the first word of the value | `Компания: Ромашка Лютик`                                                                      | Redact; regression coverage           |
| 2. A label replaces only the first word of the value | `Работодатель: Ромашка Лютик`                                                                  | Redact; regression coverage           |
| 2. A label replaces only the first word of the value | `Место работы: Ромашка Лютик, менеджер`                                                        | Redact; regression coverage           |
| 2. A label replaces only the first word of the value | `Employer: Romashka Lyutik`                                                                    | Redact; regression coverage           |
| 2. A label replaces only the first word of the value | `Company: Romashka Lyutik`                                                                     | Redact; regression coverage           |
| 3. Field names in structured mode                    | `firstName`                                                                                    | Redact; regression coverage           |
| 3. Field names in structured mode                    | `lastName`                                                                                     | Redact; regression coverage           |
| 3. Field names in structured mode                    | `middleName`                                                                                   | Redact; regression coverage           |
| 3. Field names in structured mode                    | `middle_name`                                                                                  | Redact; regression coverage           |
| 3. Field names in structured mode                    | `patronymic`                                                                                   | Redact; regression coverage           |
| 3. Field names in structured mode                    | `birthday`                                                                                     | Redact; regression coverage           |
| 3. Field names in structured mode                    | `birth_date`                                                                                   | Redact; regression coverage           |
| 3. Field names in structured mode                    | `sex`                                                                                          | Redact; regression coverage           |
| 3. Field names in structured mode                    | `citizenship`                                                                                  | Redact; regression coverage           |
| 3. Field names in structured mode                    | `nationality`                                                                                  | Redact; regression coverage           |
| 3. Field names in structured mode                    | `company`                                                                                      | Redact; regression coverage           |
| 3. Field names in structured mode                    | `companyName`                                                                                  | Redact; regression coverage           |
| 3. Field names in structured mode                    | `employer`                                                                                     | Redact; regression coverage           |
| 3. Field names in structured mode                    | `university`                                                                                   | Redact; regression coverage           |
| 3. Field names in structured mode                    | `school`                                                                                       | Redact; regression coverage           |
| 3. Field names in structured mode                    | `contact`                                                                                      | Redact; regression coverage           |
| 3. Field names in structured mode                    | `resume_url`                                                                                   | Redact; regression coverage           |
| 3. Field names in structured mode                    | `resumeUrl`                                                                                    | Redact; regression coverage           |
| 3. Field names in structured mode                    | `alternate_url`                                                                                | Redact; regression coverage           |
| 3. Field names in structured mode                    | `profile_url`                                                                                  | Redact; regression coverage           |
| 3. Field names in structured mode                    | `company_url`                                                                                  | Redact; regression coverage           |
| 4. Phone numbers with no cue word                    | `контакт: 89161234567`                                                                         | Redact; regression coverage           |
| 4. Phone numbers with no cue word                    | `пишите, 79161234567`                                                                          | Redact; regression coverage           |
| 4. Phone numbers with no cue word                    | `89161234567`                                                                                  | Redact; regression coverage           |
| 5. Share links and personal sites in text            | `портфолио https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345/view?usp=sharing` | Redact; regression coverage           |
| 5. Share links and personal sites in text            | `https://docs.google.com/document/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345/edit`                    | Redact; regression coverage           |
| 5. Share links and personal sites in text            | `https://example.org/s/9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e`                                     | Redact; regression coverage           |
| 5. Share links and personal sites in text            | `портфолио https://ivan-petrov.example.org/`                                                   | Documented ambiguous limit; preserved |
| 6. Smaller text forms                                | `С уважением,\nАнна`                                                                           | Redact; regression coverage           |
| 6. Smaller text forms                                | `учился в МГУ`                                                                                 | Redact; regression coverage           |
| 6. Smaller text forms                                | `Соискатель: Абвгде Жзиклм`                                                                    | Redact; regression coverage           |
| 6. Smaller text forms                                | `Сотрудник: Абвгде Жзиклм`                                                                     | Redact; regression coverage           |
| 6. Smaller text forms                                | `ФИО: Абвгде Жзиклм`                                                                           | Redact; regression coverage           |
| Must stay unchanged                                  | `Опыт: 3 года, 5 месяцев`                                                                      | Preservation control                  |
| Must stay unchanged                                  | `Директор, руководитель отдела`                                                                | Preservation control                  |
| Must stay unchanged                                  | `order 89161234567 shipped`                                                                    | Preservation control                  |
| Must stay unchanged                                  | `id 79161234567`                                                                               | Preservation control                  |
| Must stay unchanged                                  | `https://example.org/docs/getting-started`                                                     | Preservation control                  |
| Must stay unchanged                                  | `https://github.com/`                                                                          | Preservation control                  |
| One more case: company names in free text            | `работал в «Ромашка»`                                                                          | Redact; regression coverage           |
| One more case: company names in free text            | `работал в Ромашка`                                                                            | Redact; regression coverage           |
| One more case: company names in free text            | `работал в компании «Ромашка Лютик»`                                                           | Redact; regression coverage           |
| One more case: company names in free text            | `сильный опыт (Ромашка Лютик)`                                                                 | Redact; regression coverage           |
| One more case: company names in free text            | `опыт в Romashka и Lyutik`                                                                     | Redact; regression coverage           |
| One more case: company names in free text            | `Роль в Romashka: руководитель`                                                                | Redact; regression coverage           |
| One more case: company names in free text            | `проекты для Ромашка, Лютик и Василек`                                                         | Redact; regression coverage           |
| One more case: company names in free text            | `Romashka (2 года), Lyutik (3 года)`                                                           | Redact; regression coverage           |

## Reproduction and validation

Run `node --max-old-space-size=256 experiments/issue-100/probe.mjs` or
`node --max-old-space-size=256 experiments/issue-100/escaped.mjs` for small
reproductions. Initial probes confirmed unchanged percent-encoded queries,
JSON-only children over-redaction, and an identical escaped fragment surviving
every redaction round before `ERR_RESIDUAL`. Source evidence is preserved under
`dev/log/issues/100/pulls/101/`.

Focused verification command (no source build):

```sh
node --test --test-timeout=30000 tests/sanitizer-issue-100.test.js tests/sanitizer-experience-lines.test.js tests/sanitizer-document-entities.test.js tests/sanitizer-issue-84.test.js tests/sanitizer-issue-89.test.js tests/sanitizer-json-string-runs.test.js
```

Full platform/runtime/security/release verification runs in existing CI to avoid
duplicating expensive work locally. Local commands use small finite fixtures.

Local evidence: the original revision fails 65 of the first 80 new regression
cases; the fixed revision passes all 82, including a later overlap test for
schema values containing both credentials and escaped fragments. The six-file
focused suite initially passed 495 tests; the additional overlap regression
and punctuation regressions increase that inventory to 497. ESLint reports no warnings. Baseline failure
logs and source issue JSON are preserved under the evidence directory.

CI initially exposed a punctuation/placeholder regression in the company cue
rule: Node job 127506701952, log line 3867, and Deno job 127506701970, line 3900
of run 42101831141 both reported a missing sentence-ending period. The fix
excludes trailing punctuation from name tokens and emits company lists as
separate entities, preserving existing reversible placeholder identity. The
existing placeholder residual suite and an explicit punctuation regression
verify this boundary. Downloaded job logs are retained in `ci-logs/`.
