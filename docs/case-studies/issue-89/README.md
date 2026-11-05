# Issues 86–89: structured cost and document context

## Scope and work plan

Issue #89 requires #86, #87 and #88 in one PR, with a separate positive closing
reference for all four issues. Read the complete bodies, comment endpoints,
native sub-issues and PR #90 conversation, inline comments and reviews. All
three child issues have no comments or further sub-issues; PR #90 had no feedback.
The issue snapshots in `experiments/issue-89/` preserve every original row.
No screenshots or UI work are involved.

Plan and verification checklist:

- [x] Inventory every requirement, research alternatives and identify root causes.
- [x] Reproduce failures on archived 0.16.1 using the actual new regression suite.
- [x] Implement shared native rules so synchronous/asynchronous, text/JSON/JSONL
      and streaming consumers inherit the same policy.
- [x] Add all reported rows, privacy payload checks, restoration and ordinary-text negatives.
- [x] Measure finite serial benchmarks against both released versions; document
      remaining cost instead of claiming the optional 2x performance target.
- [x] Add a patch changeset, review the full diff and run focused compatibility checks.
- [ ] Push, inspect current-commit CI, address failures, update PR and mark ready.

## Requirement inventory and solutions

Every row below maps to `tests/sanitizer-issue-89.test.js`; its original source
rows are extracted directly from the #88 snapshot, including already detected
comparison rows. Text, JSON and JSONL are tested separately.

| Issue | Requirement                                                                                                            | Alternatives, chosen solution and verification                                                                                                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 86    | Short JSON ~100 characters, exact 264-character example, ~9 KiB JSON; cost within about 2x of 0.16.0 **or documented** | Removing standalone scans would lose #77 coverage. Retain scans, precompile personal label prefixes, avoid redundant RegExp clones when matchAll already clones, measure and document the higher cost in COVERAGE.md. |
| 86    | Preserve 0.16.1 detection                                                                                              | No scan/view removal, no personal-data cache and no dependency change. Existing #84 structured/escaped/custom-engine regressions pass, except the intentional bare-age policy superseded by #87.                      |
| 87    | `опыт работы 5 лет`                                                                                                    | Require affirmative age context; preserve.                                                                                                                                                                            |
| 87    | `стаж 12 лет`                                                                                                          | Same.                                                                                                                                                                                                                 |
| 87    | `3 года опыта`                                                                                                         | Same.                                                                                                                                                                                                                 |
| 87    | `за последние 3 года`                                                                                                  | Same.                                                                                                                                                                                                                 |
| 87    | `более 10 лет`                                                                                                         | Same.                                                                                                                                                                                                                 |
| 87    | `через 5 лет`                                                                                                          | Same.                                                                                                                                                                                                                 |
| 87    | `договор на 3 года`                                                                                                    | Same.                                                                                                                                                                                                                 |
| 87    | `Проект длился 2 года`                                                                                                 | Same.                                                                                                                                                                                                                 |
| 87    | `Задача выполнена за 3 года`                                                                                           | Same.                                                                                                                                                                                                                 |
| 87    | Bare `34 года` may remain with documented limit                                                                        | Preserve and document ambiguity; replace obsolete expectation from #82.                                                                                                                                               |
| 87    | `мне 29 лет`, `возраст: 34`, `Женщина, 34 года` still sensitive                                                        | Age label, personal pronoun, birthday verb or gender plus comma supplies context. Test exact age span and retained units; include `Мне 34`, `исполнилось 34`, `Мужчина, 41 год`.                                      |
| 87    | ECONNREFUSED stack retains newline/function after IP:port                                                              | Obfuscated-email raw scan started at the `n` in JSON `\n`. Exclude a local part immediately after backslash. Both reported stacks remain byte-identical in all modes.                                                 |
| 87    | `Гражданство: не указано`, `Дети: нет` unchanged, like gender/age unspecified                                          | Exclude unspecified attribute values; exclude `нет` only under `Дети`. Keep meaningful `инвалидность: нет` and `судимость: нет` sensitive.                                                                            |
| 87    | `/u/petr.kuz`, `/in/petr-kuz` under url redact                                                                         | Add `u`/`in` to existing personal-path exception. Test all eight path families plus operational `/api/v1/items`; general URL label coverage remains authoritative.                                                    |
| 87    | `Server listening at http://0.0.0.0:3000` unchanged; localhost and loopback remain                                     | Treat exact IPv4 unspecified bind address like local operational addresses. Explicit knownPersonal and publicKnowledge:false still redact it.                                                                         |
| 88    | `контактный телефон 926 765 4321`                                                                                      | Extend existing contextual Russian mobile grammar with телефон and qualifier.                                                                                                                                         |
| 88    | `сот. 8 926 7654321`                                                                                                   | Add cellular label to same grammar.                                                                                                                                                                                   |
| 88    | `petr.kuznetsov (собака) mail.example`                                                                                 | Add parenthesized Russian separator to existing obfuscated-email grammar.                                                                                                                                             |
| 88    | `телега: petr_kuz`                                                                                                     | Add messenger synonym.                                                                                                                                                                                                |
| 88    | `Zoom: petr.kuz`                                                                                                       | Add messenger label.                                                                                                                                                                                                  |
| 88    | `выдан ТП УФМС Перми 05.06.2015`                                                                                       | Extend dated issuer prefix with УФМС and optional ТП; protect complete issuer/date.                                                                                                                                   |
| 88    | `р/с 40817810500000000123`                                                                                             | Extend contextual 20-digit account label; protect all digits.                                                                                                                                                         |
| 88    | `г-н Кузнецов`                                                                                                         | Add title to existing surname-title grammar.                                                                                                                                                                          |
| 88    | `1985 года рождения`                                                                                                   | Add birth-year suffix; protect year.                                                                                                                                                                                  |
| 88    | `г.р. 1985`                                                                                                            | Add birth-year prefix.                                                                                                                                                                                                |
| 88    | `возраст 41`                                                                                                           | Accept whitespace age separator with numeric payload only.                                                                                                                                                            |
| 88    | `Age 41`                                                                                                               | Same in English.                                                                                                                                                                                                      |
| 88    | `Пол: Ж`                                                                                                               | Add single-letter gender after explicit label.                                                                                                                                                                        |
| 88    | `Пол: М`                                                                                                               | Same.                                                                                                                                                                                                                 |
| 88    | `пол: жен.`                                                                                                            | Add abbreviated gender.                                                                                                                                                                                               |
| 88    | `пол муж.`                                                                                                             | Add whitespace separator plus abbreviation; preserve ordinary flooring prose.                                                                                                                                         |
| 88    | `гражданин РФ`                                                                                                         | Contextual citizenship abbreviation with feminine counterpart.                                                                                                                                                        |
| 88    | `есть двое детей`                                                                                                      | Finite child-count phrase with numeral/number words.                                                                                                                                                                  |
| 88    | `проживаю в Перми`                                                                                                     | Extend existing residence context.                                                                                                                                                                                    |
| 88    | `Employer: Vasilek`                                                                                                    | Extend existing employer label to English with capitalized Unicode payload.                                                                                                                                           |
| 88    | `Company: Vasilek`                                                                                                     | Same.                                                                                                                                                                                                                 |
| 88    | `Education: MSU`                                                                                                       | Add bounded English education label/acronym.                                                                                                                                                                          |
| 88    | `Цой В. Р.`                                                                                                            | Accept capitalized Cyrillic surname plus **two** initials regardless of ending.                                                                                                                                       |
| 88    | `Ким Д. С.`                                                                                                            | Same.                                                                                                                                                                                                                 |
| 88    | `Шевченко Т. Г.`                                                                                                       | Same. Existing single-initial detection retains its finite surname/given-name requirements.                                                                                                                           |
| 88    | All nine already-detected comparison rows remain sensitive                                                             | Snapshot-driven regressions preserve phone, obfuscated email, Telegram, birth-year, age, gender, residence and titled surname coverage.                                                                               |
| 88    | Durations, `Срок 34 дня`, `Пол деревянный`, `Статус: открыт` unchanged                                                 | Positive context rather than a duration blacklist; explicit negatives in all three modes.                                                                                                                             |
| 89    | Entire required scope in PR #90; close each issue separately                                                           | Shared code paths audited; PR description contains Fixes #86, Fixes #87, Fixes #88 and Fixes #89.                                                                                                                     |

## Root causes and design decisions

The 0.16.1 structured change added full native inspection for each decoded string,
including identifier keys. That is necessary for line-start CV rules and array
values. The fixed scanning/validation cost grows with string count, even when
strings are short. A CPU profile on the exact 264-character reproduction found
repeated label-prefix construction/escaping and regex traversal among hot paths.
Hoisting the immutable prefixes removes repeated allocation without changing
labels or their matching order. `matchAll` itself clones global regular
expressions; an extra clone is unnecessary when lastIndex is zero. Preserve the
old reset-to-zero behavior for regexes with nonzero lastIndex.

Combining all decoded values into one plain-text view could allow detections
across unrelated fields. Skipping keys could lose credentials or private keys.
Caching personal strings across calls retains sensitive values and needs bounds.
These approaches were rejected. Measured remaining overhead is documented, as
#86 explicitly permits, and detection is retained.

Bare age-in-years regexes cannot distinguish ages from durations. A duration
blacklist would miss new wording. Require positive age context instead. This
intentionally supersedes #82's bare-age example under #87's clarified acceptance.

The stack miss occurred in the _raw escaped batch_, even though decoded scans
were correct: `n    at TCPConnectWrap.afterConnect` looked like an obfuscated
email. The boundary fix belongs in the shared email rule rather than a global
stack-trace exemption that could hide real secrets in stack text.

All #88 unchanged forms are implemented, including the optional surname shapes;
none is deferred as a documented unsupported row. Two initials supply stronger
structure than an arbitrary capitalized word alone. Public names/organizations
and ordinary prose can still share these shapes: coverage remains heuristic.

## Online research and existing components

- [Presidio analyzer](https://presidio.dataprivacystack.org/analyzer/) supports
  pattern recognizers, NLP engines and context enhancement. The repository
  already has a Presidio bridge. It can supplement unfamiliar names but needs
  separately configured models/languages and is unsuitable as a new synchronous
  per-log-line dependency for these finite rules.
- [libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js) parses,
  formats and searches phone numbers, with country-dependent metadata. It is
  already installed for phone transformations. Its validation is useful for
  phone semantics, but the issue needs contextual label coverage and protection
  even for invented numbers; extending the bounded existing detector is sufficient.
- [fast-redact](https://github.com/davidmarkclements/fast-redact) redacts configured
  object paths. It is useful when the caller knows a logging schema, but cannot
  discover personal prose in arbitrary string values or preserve this library's
  exact input formatting by itself. Its benchmarks are not comparable to full
  document/credential detection plus residual verification.
- [String.matchAll](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll)
  documents cloned-regexp behavior. Reusing zero-lastIndex patterns avoids the
  extra explicit clone while keeping iterator state isolated.

No new package or model download is required.

## Reproduction and evidence

Run `node experiments/issue-89/test-baseline.mjs /path/to/0.16.1/src/index.js`
against an archived release source tree with access to installed dependencies.
Run `node --test --test-timeout=30000 tests/sanitizer-issue-89.test.js` for the fix.
Run `node --max-old-space-size=256 experiments/issue-89/benchmark.mjs [other-src/index.js]`
for finite serial measurements: 100 warm-ups, three 100-call trials, median
milliseconds per sanitize call. This includes sanitization and residual checks,
not only inspection. The exact 264-character issue fixture is retained; the
89/9396-character synthetic fixtures approximate the unpublished short/9 KiB
rows, whose exact payloads were not provided.

Performance measurements and practical main-thread guidance are in
[coverage](../../COVERAGE.md#structured-json-cost-issue-86).
