# Issue 190: known-value matching (#186, #187, #188, #189)

Issue 190 asks for the four open issues to be fixed in one pull request. All four
concern `knownPersonal` with `knownOnly: true` in 0.22.5.

Reproduce: `node experiments/issue-190/reproduce.mjs` (before and after
output for every snippet in the issues).

## Requirement map

| #   | Requirement                                                                                                 | Implementation                                                                                                                                | Verification                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 186 | Opt-in: a listed value matches as an identifier segment in any case                                         | `identifiers` flag per entry or as `compileKnown` default; case-sensitive segment start through `caseless()` (`src/personal-variants.js`)     | `issue 186: identifiers` tests                                                 |
| 186 | Segment between `_`, `-`, `.` and digits, and at a lower→upper camelCase boundary; finding covers only it   | `segmentStart`/`segmentEnd` lookarounds; multi-word values join with `_`, `-`, `.` or a case change                                           | snake/camel/SCREAMING/digit/`getTyutyunnikName` cases                          |
| 186 | Opt-in: common romanizations of a Cyrillic value (GOST 7.79-B, ICAO/MVD 2013, BGN/PCGN, popular `-iy`/`-y`) | `transliterate` flag; per-letter alternatives (`latinLetters`), iotated `е`→`ye`/`je`, `кс`→`x`, adjective endings                            | `issue 186: transliteration` tests, including every letter of each system      |
| 186 | Case-insensitive, combined with identifiers                                                                 | Both flags compose (`TSOY_YULIA`, `tsoiIuliia`)                                                                                               | `is off by default and combines with identifiers`                              |
| 187 | One line break between parts matches; the finding spans both lines                                          | `lineBreak` gap: one `\r?\n` plus optional `//`, `#`, `--`, `*`, `>`, `;` prefix                                                              | `issue 187` tests                                                              |
| 187 | Comment/quote prefix continuation; blank line stays a separator                                             | Prefix group allows nested `> >`; a second line break is not allowed                                                                          | blank line and CRLF cases                                                      |
| 187 | Stays safe on long whitespace runs                                                                          | Each whitespace run has one bounded quantifier                                                                                                | `stays linear on long whitespace runs`                                         |
| 188 | No nested duplicate when the surname is listed with the full name                                           | `dropNestedKnown` after same-span merging (`src/sanitizer.js`)                                                                                | `drops a listed part nested in a listed full name`                             |
| 188 | Given name + patronymic does not match alone (README rule)                                                  | `russianForms` adds that pair only for identity linking (`related`), not for detection                                                        | `needs the surname or its own entry`; `sanitizer-known-forms` updated          |
| 188 | Given name + surname initial (`Велимира П.`, `Velimira P.`)                                                 | `givenAndInitial` forms, all cases, with or without the dot, Latin when transliterating                                                       | `matches a given name with the surname initial`                                |
| 189 | First `inspect` calls must not pay 1.5–3 ms per entry                                                       | `src/known-matcher.js`: literal anchors per expression, one folded scan per call, lazy compilation, sticky execution at anchor positions      | `keeps the first call fast for a large list`; `compiles only the expressions…` |
| 189 | Optional eager warm-up                                                                                      | `compileKnown(…, { warm: true })`                                                                                                             | `warms every expression with warm: true`                                       |
| 189 | Same results as running every expression                                                                    | Prefilter only skips positions where no anchor occurs; case folding verified for every code point                                             | `finds what running every expression finds`; `folds every … equivalent`        |
| 190 | One PR, closing references for 186–190, docs, changeset                                                     | README, `docs/API.md`, `docs/COVERAGE.md`, `src/index.d.ts`, `examples/known-names-in-code.mjs`, `.changeset/issue-186-189-known-personal.md` | CI                                                                             |

## Choices

- **#188.2:** of the three options in the issue, this follows the README. A given name
  with a patronymic needs its own entry. Placeholder identity linking still treats it
  as the same person once the full name is known in the document.
- **#186 transliteration:** existing libraries were reviewed:
  [cyrillic-to-translit-js](https://www.npmjs.com/package/cyrillic-to-translit-js),
  [cyrillic-romanization](https://www.npmjs.com/package/cyrillic-romanization)
  (GOST 7.79-B) and [iuliia](https://pypi.org/project/iuliia/) (Python, many schemas).
  They convert one string to one spelling. Matching needs every spelling at once, as
  one regular expression alternative per letter, so a dependency would not help. The
  letter table follows the comparison in
  [Romanization of Russian](https://en.wikipedia.org/wiki/Romanization_of_Russian).
- **#189 prefilter:** V8 interprets a regular expression on its first execution and
  compiles it natively when it tiers up ([V8 blog](https://v8.dev/blog/regexp-tier-up)),
  and each step costs about 1–3 ms for these expressions
  (`regexp-compile-cost.mjs`, `explicit-class-cost.mjs`). An Aho–Corasick automaton
  over the expanded spellings was ruled out: Russian declension and transliteration
  alternatives make the literal set combinatorial. A short literal anchor per
  alternative, compared after case folding, is enough to skip almost every entry.
  Case folding uses `toLowerCase` with the exceptions found by
  `fold-exceptions.mjs` and `fold-exceptions-wide.mjs` (`ё`→`е`, `ſ`→`s`, the
  Cyrillic small-letter variants `ᲀ`–`ᲆ`). The test suite checks them against every
  code point.

## Measurements (Node v26.13.0, Linux x64)

`node experiments/issue-190/warmup-cost.mjs 500 2500`: generated Russian names, and
a short text that names none of them.

| Entries | Version | `compileKnown` | first 3 `inspect` calls | later calls |
| ------: | ------- | -------------: | ----------------------: | ----------: |
|     500 | 0.22.5  |         364 ms |         1366, 137, 2 ms |      2–6 ms |
|     500 | branch  |         296 ms |              8, 0, 0 ms |      0–1 ms |
|    2500 | 0.22.5  |        1190 ms |      7991, 2381, 139 ms |    13–14 ms |
|    2500 | branch  |         772 ms |              1, 0, 0 ms |      0–1 ms |

`node experiments/issue-190/long-text-cost.mjs 2500` is the adversarial case: a
100 KB text built from the same syllables, where every entry's anchor occurs. A
steady call takes about 0.8 s on the branch and 5.4 s on 0.22.5. The first call
takes about 13 s on the branch (5.4 s after `warm: true`) and 13–18 s on 0.22.5, because
every expression has to be compiled.

## Scripts

- `reproduce.mjs`: every snippet from the four issues.
- `doc-claims.mjs`: the behavior described in `docs/API.md`.
- `warmup-cost.mjs`, `long-text-cost.mjs`: first-call and steady cost.
- `regexp-compile-cost.mjs`, `explicit-class-cost.mjs`: V8 compile cost per expression.
- `fold-exceptions.mjs`, `fold-exceptions-wide.mjs`: case-folding exceptions.
- `debug-candidates.mjs`: anchors and candidates for one entry.
