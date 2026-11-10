# Issue 144: document attribute, vocabulary and placeholder regressions

All five requirements are implemented in PR #145. The issue has no required
sub-issues and had no comments; the PR had no conversation, inline or review
feedback at initial inspection.

| Requirement               | Root cause and implementation                                                                                                                                                                           | Verification                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 34 special-category words | Missing bounded nationality/religion/health/political forms and English words restricted to personal cues. Extend strict lexicon, allowing the requested standalone words.                              | All 34 words in bare, labeled and sentence frames get `PersonalAttribute-1`; inflected forms and word boundaries also tested.                               |
| Caller attribute label    | Overlap merging retained `PROPER_NAME` ahead of `PERSONAL_ATTRIBUTE`. Prefer the specific attribute type while retaining explicit transformation precedence.                                            | `Zorvian` (outside built-ins), `Baptist` and `старовер` in all frames, sync and async.                                                                      |
| Vocabulary cost           | Every lookup normalized and serialized lists, while every prose cue lookup allocated an array. Use a WeakMap by vocabulary identity plus a compiled folded cue Set.                                     | Repeated lookup never rereads caller lists; existing vocabulary replacement/validation tests pass.                                                          |
| Existing-token cost       | Every pass constructed namespace checks and decoded JSON strings without tokens. Pre-check default token shape, positive digits and escapes; retain full scans for custom formats and escaped literals. | Placeholder-free JSON, custom formats, existing numbering, escaped collisions and residual safety suites.                                                   |
| Technology names          | Generic Latin capitals in Cyrillic prose lack public knowledge entries. Add exact sourced spellings across languages, databases, frameworks, tools and cloud services.                                  | Every catalog row, all three reported sentences, disabled public knowledge, private values, credentials, adjacent Ivan Petrov and longer noncatalog tokens. |

Vocabulary objects are compiled on first use and should be treated as immutable;
pass a new object to change lists. This follows the identity-cache option proposed
in the issue. Technology entries exempt only exact generic prose findings;
`Node.js` also needs an exact URL exemption because it is a domain-shaped token.
No containing URL, personal name, identifier or credential inherits an exemption.
Strict mode deliberately treats the reported English words as attributes even
without a personal cue, as the issue requests.

## Reproduction and automated verification

```sh
node --test --test-timeout=30000 tests/sanitizer-issue-144.test.js
node --max-old-space-size=256 experiments/issue-144/benchmark.mjs
```

The new regression suite was run against a separate copy of the original `src`
from commit `147e9bf`. It fails on `кабардинец`, `кабардинцем`, the sentence
`Zorvian` label, cue compilation reuse, `Навыки: Python`, and unnecessary parsing
of an unescaped token literal. The production source was never reverted in the
working tree. The new tests pass with the fix. The focused existing suites also
cover vocabulary configuration validation, operational ambiguous words,
placeholders, custom types, escapes and residual verification.

## Bounded performance experiment

Node 26.13.0, five interleaved rounds of five calls per variant per input, one
warmup call per engine, 256 MiB JS heap cap. Inputs are synthetic. Short and
preview log variants explicitly use `structured: 'json'`. Results are medians
in milliseconds per call and are observations, not timing assertions.

| Input / variant              | Original | Fixed |
| ---------------------------- | -------: | ----: |
| 1 KB Russian prose / base    |    14.20 | 14.21 |
| Prose / empty vocabulary     |    18.97 | 16.39 |
| Prose / empty attributes     |    19.58 | 16.72 |
| Prose / one attribute        |    20.15 | 16.50 |
| Prose / 34 attributes        |    27.23 | 16.54 |
| Prose / existing keep        |    15.72 | 14.24 |
| Short JSON / base            |     9.99 | 10.47 |
| Short JSON / existing keep   |    13.60 |  9.96 |
| Preview JSON / base          |    14.60 | 15.52 |
| Preview JSON / existing keep |    18.84 | 15.49 |

The empty-vocabulary path still enables additional cue recognizers. The fix
removes repeated normalization/serialization and the dependence on list length;
it does not assert that enabling recognizers has zero cost. The default-token
pre-check removes the reported keep-mode premium on these token-free JSON lines.
Full runtime/platform and security checks run in CI.
