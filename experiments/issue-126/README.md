# Strict category attributes and operational text

Policy: `profile: 'documents', properNames: 'capitalized', strict: true`.
All inputs are synthetic. No issue comments or required sub-issues were present.

Run the bounded reproducer without building the package:

```sh
node experiments/issue-126/reproduce.mjs
```

Run the regression suite:

```sh
node --max-old-space-size=384 --test --test-concurrency=1 --test-timeout=30000 tests/sanitizer-issue-126.test.js
```

## Requirements and evidence

| Requirement                                      | Implementation                                                                                          | Verification                                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Protect every special-category row in issue 126  | `src/strict-attributes.js`: bounded case/stem lexicon and explicit category cues                        | Every reported row in text, JSON and JSONL; complete attribute source spans; both engines; repeat sanitization          |
| Preserve already-protected examples              | Existing lexicon retained, with complete `ВИЧ-инфицирован` coverage                                     | All seven issue examples in all three formats                                                                           |
| Cover forms beyond a fixed list                  | Russian inflections and a bounded following word after nationality, religion and health cues            | Additional cases/plurals and unfamiliar `эвенк`, `синтоизм`, `акромегалией`, `нарколога`, `sarcoidosis`, `fibromyalgia` |
| Preserve operational English and JSON statuses   | Ambiguous English attributes require adjacent personal context; technical continuations remain ordinary | All eight prose controls and all three statuses in both engines; JSON and JSONL                                         |
| Retain personal uses of ambiguous words          | Pronoun, person-role and personal-label cues                                                            | `he is disabled`, `candidate is single`, `I am a man`, `gender: male`, `nationality: russian`, `maritalStatus`          |
| Preserve configuration and structured boundaries | Existing strict opt-in, rule/type filtering, known values and source projection                         | Strict off, credentials only, rule/type disabling, known-personal override, escaped strings and cross-value controls    |
| Trace decisions without exposing values          | Optional `strict-attributes` debug event                                                                | Exact detected/suppressed counts; TypeScript event definition                                                           |
| Prepare release                                  | Patch Changeset                                                                                         | Existing release automation consumes fragment                                                                           |

## Root cause and before/after

The original detector matched two fixed regular expressions. They omitted
Russian case forms, many category terms and open-category cues. The same rules
matched `disabled`, `single`, `man`, `russian` and `asian` unconditionally.
The initial 114-case regression run failed 96 cases and passed 18 on the base
implementation. With the fix, all 114 pass.

Representative changes:

| Input                         | Before                            | After                          |
| ----------------------------- | --------------------------------- | ------------------------------ |
| `является инвалидом 2 группы` | unchanged                         | `является [REDACTED] 2 группы` |
| `по национальности армянин`   | unchanged                         | `по национальности [REDACTED]` |
| `болеет эпилепсией`           | unchanged                         | `болеет [REDACTED]`            |
| `гепатит C`                   | `гепатит [REDACTED]`              | `[REDACTED] [REDACTED]`        |
| `the module is disabled`      | `the module is [REDACTED]`        | unchanged                      |
| `single-flight lock acquired` | `[REDACTED]-flight lock acquired` | unchanged                      |
| `{"status":"Russian"}`        | `{"status":"[REDACTED]"}`         | unchanged                      |

The existing issue-118 expectation for bare `single` intentionally becomes a
preservation control, matching the requested operational-value behavior. A
personal cue still protects that word. Other existing strict expectations stay.

These are finite symbolic rules: category cues protect one following word up to
64 characters, including hyphenated words. They do not infer arbitrary multiword
diagnoses or all possible cue-free attributes. Strict mode remains opt-in and
may redact ordinary uses of unambiguous category words. Explicit caller-known
values remain available for unsupported forms.

Local focused compatibility verification covers the issue-118 catalog,
issue-120 durations and document values, issue-124 honorifics and JSON fields,
and the new suite. The first compatibility run passed all 505 tests; subsequent
additions extend the issue suite with inflections and structured boundaries.
