# Issue 142: sanitizer requests 130–141

Issue 142 asks for one pull request that resolves the twelve reports filed
against 0.19.3 (#130–#141). Every report was reproduced first: the upstream
reproductions are in `experiments/issue-142/upstream-repros.mjs` (run it with
a block name such as `idempotency`), and each fix adds tests in
`tests/sanitizer-issue-142-*.test.js` that fail before it (checked by stashing `src` and re-running the test).

## Requirements and resolutions

| Issue | Requirement                                                                                                             | Root cause                                                                                                | Resolution                                                                                                                                                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #130  | 1. A second pass over placeholder output must not throw                                                                 | Every namespace token was a collision                                                                     | `transformation.existing: 'keep'` keeps tokens (`kept: 'fake'`) and numbers new values after the highest kept number per type                                                                                              |
| #130  | 2. No `[REDACTED]` in placeholder mode                                                                                  | `JSON_VALUE` always rendered `"[REDACTED]"`                                                               | Whole JSON values become `Sensitive-n`, or the field's type (`Age-n`) through `valueType`; restore is exact                                                                                                                |
| #130  | 3. Readable labels and boundaries under `properNames`                                                                   | The capitalization rule replaced every capitalized word; document spans lost to the fragments inside them | `src/prose-words.js` keeps pronouns, cues and sentence-initial greetings, function words and verbs; compact document spans are typed as one value; oblique surnames link to the unique fullest name; `url` keys need a URL |
| #130  | 4. 21 special-category rows left in strict prose                                                                        | Vocabulary gaps                                                                                           | Nationality, religion, health, sexuality, conviction and trade-union stems; ambiguous English words need a personal cue                                                                                                    |
| #130  | 5. Caller-extensible special categories                                                                                 | No vocabulary list                                                                                        | `vocabulary.personalAttributes` (stems plus up to eight letters, strict only)                                                                                                                                              |
| #130  | 6. Exported namespace                                                                                                   | Internal helpers only                                                                                     | `reservedPlaceholderTypes()` and `isPlaceholderToken()` in both entries                                                                                                                                                    |
| #130  | 7. Placeholder cost about 2× redaction                                                                                  | The namespace pattern was rebuilt on every call                                                           | Cached per format (64 entries); `experiments/issue-142/issue-130.mjs 7` measures 3.7 ms/call placeholder against 4.0 ms/call redact                                                                                        |
| #131  | Authorization keeps its scheme; Digest masks only secret parameters                                                     | One span covered scheme and value                                                                         | Scheme word kept; Digest, OAuth and SigV4 parameter lists mask secret values only                                                                                                                                          |
| #132  | Readable context around credentials                                                                                     | Spans extended to the end of the context                                                                  | URL user kept, webhook host and path words kept, PEM armor and text between blocks kept, one cookie value per pair, line values end with the vendor token                                                                  |
| #133  | A second pass is a no-op; other tools' `***` masks stay                                                                 | Already handled on 0.20.0 for `***`; encoded masks were re-masked                                         | `hive-mask` and mask output (and the NFKC `...` projection) are recognized as masked                                                                                                                                       |
| #134  | Numeric flags under configuration names are settings                                                                    | Any value under an AUTH name was a credential                                                             | Numbers and booleans under `_MODE`, `_TRANSPORT`, `_GUARD`, … are kept                                                                                                                                                     |
| #135  | A verified way to keep a finding                                                                                        | A callback returning the value failed `ERR_RESIDUAL` by design                                            | `exempt(finding, text) => boolean`, consulted again per span during verification                                                                                                                                           |
| #136  | Missed credential shapes                                                                                                | No rules for these shapes                                                                                 | `marker-token`, XML attributes, hash rockets, values starting with markup, plural flags                                                                                                                                    |
| #137  | Fast credentials-only loading and `require`                                                                             | The root entry imports every personal module                                                              | `./credentials` entry through a feature registry, about 3× faster; `require` and `default` conditions                                                                                                                      |
| #138  | Wrapped base64 keeps its wrapping and is reported once                                                                  | Re-encoding emitted one line                                                                              | Line width and separator recorded and re-applied; one finding per wrapped run                                                                                                                                              |
| #139  | Long logs neither throw nor are masked whole                                                                            | A global candidate count and a whole-run fallback                                                         | 4,096 candidates per 64 KiB window; identifier and hash lists are scanned line by line                                                                                                                                     |
| #140  | Hex of a known secret of any length; no `ERR_ENCODING`                                                                  | A 16-digit minimum and re-encoding failure                                                                | Hex (both cases) and base64/base64url spellings of known secrets; payloads that cannot be re-encoded are masked as they stand                                                                                              |
| #141  | Default env selection without flags, counters, paths and `GIT_CONFIG_KEY_n`; with `PGPASSWORD`, `*TOKEN` and `*_COOKIE` | A keyword-only name pattern                                                                               | Configuration suffix exclusions, suffix keywords, `GIT_CONFIG_VALUE_n` by its key, opt-in `minLength`                                                                                                                      |

## Decisions

- **#130 typed JSON values.** `Sensitive-n` was chosen over field-name types
  such as `Notes-1`: a field name can be personal itself, and a stable type
  keeps the namespace closed (`reservedPlaceholderTypes()` stays complete).
  Fields with a personal type use it (`Age-1`).
- **#130 common words.** A word that is also a given-name form (`Вера`,
  `Любовь`) never enters the lists, and a bare masculine `-л` form is kept only
  before a lowercase word (`Шагал Марк` is still replaced). Verb shapes and
  greetings count only at the start of a sentence; pronouns and cues count
  anywhere. This keeps the rule biased towards removal, as the
  `properNames` contract requires.
- **#130 strict vocabulary.** Words with an ordinary technical meaning
  (`Korean locale`, `union member list`, `served time 12ms`, country and
  language names) need a personal cue, matching the existing treatment of
  `disabled` and `single`. The categories follow GDPR article 9(1) and
  152-FZ article 10.
- **#137.** Some shared modules (context labels, structured parsing) stay in
  the core; the loading test pins that no personal-data module is imported.
- **#139.** Beyond the per-window budget the remaining candidates fail
  closed as `ENCODED_LIMIT` spans; only hex runs that are not a uniform base64
  layout are scanned line by line. The session-identity fixture changed
  because its hash list is no longer one encoded run.
- **#141.** `minLength` is opt-in so that short real passwords are still
  selected by default. A `hosts.yml` with aliases or a symlink stays a hard
  `ERR_AUTH`.

## Related tools

- [Presidio anonymizer](https://microsoft.github.io/presidio/anonymizer)
  offers `replace`, `mask`, `hash`, `encrypt`, `redact`, `keep` and `custom`
  operators per entity. `keep` is per entity type, not per finding, which is
  why #135 adds a per-finding `exempt` hook that verification consults again.
- [GDPR article 9](https://gdpr-text.com/en/read/article-9/) lists the special
  categories that #130 section 4 covers: racial or ethnic origin, political
  opinions, religious beliefs, trade-union membership, genetic, biometric and
  health data, sex life and sexual orientation.

## Verification

- `node --test tests/sanitizer-issue-142-*.test.js`
- `node experiments/issue-142/issue-130.mjs [1-7]` prints the issue 130 rows.
- `node experiments/issue-142/strict-cost.mjs` measures the strict rule on a
  186,000-character log (about 0.5 s, 16% above the rule without the new
  vocabulary).
- `node examples/second-pass-placeholders.mjs` runs the issue 130 policy twice.
