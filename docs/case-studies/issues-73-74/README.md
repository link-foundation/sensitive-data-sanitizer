# Issues 73–75: reused map parts and labelled experience lines

Issue 75 asks for #73 and #74 to be solved in one pull request. None of the three issues had comments when this was written. The directory `docs/case-studies/issue-75` belongs to an older, unrelated repository issue, so this study uses its own name.

## Root causes

**#73.** Three separate paths let a map from an earlier document act as evidence in the next one:

1. `placeholderNameFindings` built bare, case-insensitive `-ов`/`-ев` surname patterns from stored values. This is why `петров` matched and `мороз` did not.
2. `related` linked a single word to any part of a stored alias, and `state.people` included stored values, so the bare word was resolved to the stored person.
3. `placeholderReplacement` then recorded the surface as a new value (`["Петров Данил", "петров"]`). Maps saved by 0.14 and 0.15 therefore carry bare values that `placeholderKnown` offered as known values.

`ERR_RESIDUAL` was the correct final guard: `Алина Person-1` is detected by `name-gazetteer`, and `Роман Person-1` only passed because `Роман` was not listed.

**#74.** `lineTitle` was anchored on the line start with an optional list marker and at most six words, so any label moved the title out of reach. `по н.в.` was not an open range end.

## Requirements and solutions

| ID    | Requirement                                                                                  | Solution                                                                                                                                                         | Verification                                                              |
| ----- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| R73.1 | A reused entry matches the full value and contiguous parts, all cases, both orders, initials | Full values still reach `detectKnownPersonal`; stored people still produce initial patterns                                                                      | `still resolves the full forms in` rows                                   |
| R73.2 | A bare part does not match unless stored as its own value                                    | Bare patterns and the `related` part rule need evidence from this document; `reusablePersonValues` drops recorded parts; a listed part is stored in `standalone` | `matches a fresh map on` rows, `issue 73: a part stored as its own value` |
| R73.3 | No lower-case match of a capitalized value, except the whole value in lower case             | A single capitalized stored word carries `properCase`, checked in `detectKnownPersonal`; multi-word values stay case-insensitive                                 | `does not match ordinary lower-case text`, `петров данил` row             |
| R73.4 | A matching bare part covers the adjacent given name or patronymic; a new name gets a token   | `coverAdjacentNames` extends the span using `isNameForm`, and the longest span wins                                                                              | `gives the whole mention its own token` rows                              |
| R73.5 | The shared-map refusals disappear without new under-redaction                                | All of the above. Evidence from the current document, its stream batches and decoded values is kept                                                              | Issue rows, `keeps one token across` tests, the full existing test suite  |
| R73.6 | The #67–#70 examples keep working                                                            | `canonicalKnown` still resolves a listed part to its fullest listed value                                                                                        | Existing suites, unchanged                                                |
| R74.1 | A label of one or two words before the title with `:`, `-`, `—` or `\|`                      | `lineLabel` after the list marker, and a segment may start after `\|`                                                                                            | `accepts a label or an open range in` rows                                |
| R74.2 | The date range stays the anchor                                                              | The range part of the rule is unchanged                                                                                                                          | `needs the date range` rows, including the issue's prose row              |
| R74.3 | `по н.в.` is an open range end                                                               | Added to `rangeOpen`, with `по н/в`                                                                                                                              | `Менеджер, Ромашка (2018-01 – по н.в.)`, and a negative `по н.входу` row  |
| R74.4 | Titles of one to nine words, per the corpus note                                             | The title repeat is now `{0,8}`                                                                                                                                  | Nine-word title row                                                       |
| R74.5 | Exact restore; default-profile fixtures unchanged                                            | The rule stays gated by `documentEntities`                                                                                                                       | `roundTrip` on each row, `stays inside the documents profile`             |
| R75.1 | All in one pull request with `Fixes` per issue                                               | Pull request 76                                                                                                                                                  | Pull request description                                                  |

## Decisions

- **The reference is a fresh map.** The issue defines the expected output as "the same as a fresh map". When a document itself contains `Петров Данил`, a lower-case `петров` in that document is still linked to it, as it is with a fresh map. Tightening this would change fresh-map output and could add under-redaction, so it stays and is documented.
- **Fake mode is unchanged.** `canonicalPerson` keeps its part rule for its callers, and `coverAdjacentNames` runs only for placeholders.
- **The extra given names stay out of the detector.** `Роман` is also an ordinary noun, so `mentionGivenNames` only decides about a neighbour of a known person.
- **The new map field is optional.** `standalone` is validated when present, and existing maps need no migration.

## Remaining limits

- The private 175-CV corpus cannot be re-measured here, so the shared-map refusal count is verified only through the reproductions in the issue.
- A given name outside the bounded list stays next to the placeholder when a stored bare part matches.
- `Позже Петров` is still one `name-identity` span, in fresh and reused maps alike. This predates the change.
- A map saved by an earlier version cannot distinguish a part the caller listed from one that was only recorded, so a single word that is part of a longer value in the same entry is treated as recorded. List it again in `knownPersonal` to keep it.

## Existing components considered

No library was adopted: the package is a JavaScript library with finite rules, and the components below are Python pipelines.

- [LangChain's reversible Presidio anonymizer](https://git.blob42.xyz/Archives/langchain/commits/commit/cd00a87db732687d0d6a9ffdc1eb9f6f5ebc49b6/libs/experimental/langchain_experimental/data_anonymizer) keeps a mapping across texts, the same shape as a reused restore map. Mapping keys there are exact values, which sidesteps part matching but would not link Russian case forms.
- [Natasha](https://pypi.org/project/natasha/) provides Russian morphology tagging, lemmatization and name extraction. It would help with `isNameForm`, at the cost of a Python runtime and models. Its surname case handling was not confirmed from its documentation.
- [pyresparser](https://pypi.org/project/pyresparser/1.0.6/) extracts company names and designations from resumes through an NLP pipeline. A [rule-based description of resume parsing](https://www.lido.app/blog/resume-ocr) pairs a date range with a nearby capitalized phrase, the same anchor as this rule.

## Reproduction

`experiments/issue-75/` holds the scripts: `trace-73.mjs` for the issue rows, `edge-73.mjs` for adjacent cases, `optin-73.mjs` for stored parts, and `lines-74.mjs` for the experience table and hostile timing.
