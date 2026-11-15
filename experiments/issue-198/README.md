# Issue 198: known-name matching gaps (#192–#197)

Issue #198 collects six `knownOnly: true` / `knownPersonal` bugs of 0.23.0.
Every name in these experiments is made up.

## Scripts

| Script                   | What it shows                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `reproduce.mjs`          | All 73 calls of the six issues with the expected spans (`node reproduce.mjs` → `73/73`)       |
| `records.mjs`            | A name split over record fields in JSON, YAML, CSV/TSV, Markdown, XML, SQL, env, INI, queries |
| `encoded-now.mjs`        | Percent, HTML, escaped, stress-marked and look-alike spellings                                |
| `separated-sanitize.mjs` | Placeholder and fake output for names split by cells, quotes and Markdown                     |
| `restore.mjs`            | Placeholder output restores to the input                                                      |
| `probe.mjs`              | Underscore edges and lone surnames                                                            |
| `view-timing.mjs`        | Cost of the decoded view on 1 MB inputs                                                       |
| `records-timing.mjs`     | Cost of record matching on 1 MB inputs                                                        |
| `gap-timing.mjs`         | Long runs of separator marks cannot backtrack quadratically                                   |

## Requirements and where they are met

| Issue | Requirement                                                                                                     | Implementation                                                             | Tests                                                |
| ----- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| #192  | Parts separated by `,` `;` `\|` `/` `\` brackets, quotes, `'` outside a word, Markdown `*` `_` `` ` ``, `—` `–` | `textGap` in `src/personal-variants.js`                                    | `issue 192` in `tests/sanitizer-issue-198.test.js`   |
| #192  | `-` inside a word stays part of it (`Римский-Корсаков`), `O'Neil` stays one word                                | negative lookahead `(?![_'’-]+\p{L})` in `textGap`                         | same                                                 |
| #192  | Replacement keeps the table cells and quotes                                                                    | `separatedParts` in `src/known-records.js`, applied in `validatedSpans`    | same, placeholder and fake modes, restore round trip |
| #193  | First, last and middle name in separate fields of one record                                                    | `detectKnownRecords`, `structuredRecordFindings` in `src/known-records.js` | `issue 193`                                          |
| #193  | Same person in placeholder and fake modes                                                                       | findings share the entry and the canonical value                           | `issue 193`                                          |
| #194  | An initial is an upper-case letter (`Он же в офисе.` is no `Же В.`)                                             | `initialLetter` without the `i` flag, `caseless` for the rest              | `issue 194`                                          |
| #195  | Initials before the surname (`Е. О. Тютюнник`, `В.О. Пряжкина`)                                                 | `initialForms` and `initialGap` in `personalPatterns`                      | `issue 195`                                          |
| #196  | Plural surnames (`Пряжкины`, `Ольховецких`)                                                                     | `possessivePlural`, `adjectivePlural` surname endings                      | `issue 196`                                          |
| #197  | Percent, HTML references, `\n`/`\t` escapes, invisible characters, stress marks, look-alike letters             | `knownView` in `src/known-view.js`, used by `detectKnownValues`            | `issue 197`                                          |
| #197  | The finding covers the encoded original and links to the same person                                            | the view maps every decoded character to its original range                | `issue 197`                                          |
| #198  | All six fixed in one PR, with bounded cost                                                                      | this branch                                                                | `issue 198: bounded cost`, `reproduce.mjs`           |

## Design choices

- **One gap expression.** Separator marks before and after the single
  permitted line break are two quantifiers, so a long run of marks cannot
  backtrack quadratically (`gap-timing.mjs` grows linearly).
- **`_` at a name edge.** For a value of several words, a `_` at a word edge is
  Markdown emphasis (`_Пряжкина Велимира_`). For a one-word value it stays part
  of the word: `_Lee` and `Lee_` may be identifier fragments, which the issue
  #64 tests (`tests/sanitizer-issue-65.test.js`) require.
- **Parts replaced one by one.** A span like `Пряжкина | Велимира` is split at
  its separators before replacement, so `| Person-1 | Person-1 |` keeps the
  table. A line break, spaces, an encoded name and one value with `_` inside it
  (`Петров_Иван_CV.pdf`) keep one span, so `// Тютюнник\n// Евсей` stays
  `// Person-1` as the issue #187 tests require.
- **Records.** A key names a role (given name, surname, patronymic) from a
  bounded list of exact keys and suffixes in English and Russian. Fields join
  only within one record: a blank line, another JSON object, another list item
  or another XML parent ends it. A record needs the surname and another listed
  part, so a lone `first_name: Jane` is not a match.
- **Decoded view for known values only.** Credential and pattern detectors
  keep their own views. With `decode: false` the view keeps encodings as they
  are, but still removes invisible characters and normalizes stress marks and
  look-alike letters, since those are spellings of a word, not an encoding.
- **Encoded findings in `encodedDetect`.** When a percent or HTML run decodes to
  a known name, the generic encoded-run detector no longer reports an extra
  `EncodedSensitive`; the known finding already covers the run, so the output
  is `Person-1` and restores.

## Existing libraries considered

- **HTML references:** [`he`](https://www.npmjs.com/package/he) (Mathias
  Bynens) and [`entities`](https://github.com/fb55/entities) (fb55) decode all
  of the 2,231 HTML named references. The view only needs numeric references
  and the names that can sit inside or between the words of a name (spaces,
  invisible characters, quotes, dashes and the Cyrillic `&Pcy;` family), so a
  bounded table of 118 names covers them without adding a runtime
  dependency to the package.
- **Percent-encoding:** the built-in `decodeURIComponent` decodes valid UTF-8
  runs; invalid bytes fall back to a per-character decode that keeps each
  invalid `%XX` as written.
- **Look-alike letters:** [UTS #39](https://www.unicode.org/reports/tr39/)
  defines `confusables.txt` skeletons and mixed-script detection; crates such
  as [`intl`](https://docs.rs/crate/intl/0.4.0/source/src/unicode/spoof.rs)
  implement the skeleton (NFD, prototype mapping, NFD). A full skeleton maps
  thousands of characters and would also fold legitimate words. The view only
  swaps the 18 Latin and Cyrillic letters that look the same, and only inside a
  word that mixes the two scripts, toward the script of most of its letters.
- **Known-value recognizers:** [Presidio's deny-list
  recognizer](https://microsoft.github.io/presidio/tutorial/01_deny_list)
  matches listed words exactly; misspellings, inflections and encodings must be
  listed by hand. The repository's own matcher already generates Russian forms,
  initials and transliterations, so the fixes extend it.

## Measurements

Quiet machine, Node.js 26, `knownOnly: true`, one listed name, 1 MB input:

| Input                | This branch | 0.23.0  |
| -------------------- | ----------- | ------- |
| mixed Cyrillic/Latin | 394 ms      | 333 ms  |
| percent-encoded URLs | 620 ms      | 630 ms  |
| HTML references      | 1585 ms     | 1234 ms |

Record matching (`records-timing.mjs`, about 1 MB each): prose 151 ms, YAML
541 ms, CSV 624 ms, key/value lines 316 ms.
