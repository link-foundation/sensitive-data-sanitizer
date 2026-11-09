# Issue 122 requirements and verification

Policy: `profile: 'documents', properNames: 'capitalized', strict: true`.
There are no required sub-issues or issue/PR review comments at implementation time.

| Requirement                                          | Implementation                                                    | Regression evidence                                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Bare AQVN API key and `key AQVN…`                    | Native `yandex` service rule                                      | All reported forms in text, JSON and JSONL; complete credential spans                       |
| Bare t1 IAM token                                    | Same rule, with optional payload/signature padding                | Both unpadded and padded synthetic tokens                                                   |
| Bare YCAJE static ID and YC static secret            | Same provider rule                                                | Exact replacement and credential classification, including outside documents                |
| candidateName/candidate_name/displayName Latin value | Explicit document fields and default personalFields vocabulary    | Both engines and JSON/JSONL; normalized/escaped keys                                        |
| originalFileName Latin filename                      | Same complete-string field policy                                 | Entire filename replaced                                                                    |
| age and birthYear numbers                            | Reuse whole-value structured replacement                          | Valid JSON string replacement, nested fields, exponent notation, unrelated numbers retained |
| Compound fullName                                    | Explicit personal field vocabulary                                | Both engines and formats                                                                    |
| candidate/recruiter/applicant, Dear/Hi, Mr/Ms/Dr     | Bounded contextual Latin name detector                            | Exact cue/name/punctuation outputs in both engines and all formats                          |
| message from Ivan: ok                                | Same detector, colon outside name span                            | Exact result in both engines and formats                                                    |
| Preserve Request Failed and Candidate Stage          | No broad Latin activation; finite generic role-heading exclusions | Exact preservation and idempotence                                                          |
| Tests and release preparation                        | Issue suite and patch Changeset                                   | Focused tests, lint, format and PR CI                                                       |

## Reproduction

Run the checked-in suite against the parent source to reproduce the leaks:

```sh
node --max-old-space-size=384 --test --test-concurrency=1 --test-timeout=30000 tests/sanitizer-issue-122.test.js
```

The initial 66-case suite failed 60 tests on `28b6611`; only the six English
preservation controls passed. With the implementation, the expanded suite passes
75/75. The combined issue-118 API, issue-120, issue-122 and structural prose
integration suites pass 174 tests. These cover both engines, worker/CLI/stream
compatibility, policy controls, escaped source offsets and repeated redaction.
ESLint passes with zero warnings; modified files pass Prettier.
Full platform/runtime and security validation is provided by the existing PR CI.

## Root causes and scope

Provider patterns previously required Yandex labels through external catalogs;
add native prefix recognition using the official
[IAM grammar](https://yandex.cloud/en/docs/iam/concepts/authorization/iam-token)
and [security format catalog](https://yandex.cloud/en/docs/security/standard/authentication).
All tokens in tests are generated synthetic values. No online verification occurs.

The previous explicit field list omitted these keys. String-only structured
batches also skipped primitive numbers. Reuse the existing `JSON_VALUE` path
for numeric personal attributes so replacing a number produces valid JSON.
Field scanning and type/rule policy controls still apply. Nulls remain null.
The field list stays explicit: bare name, jobName and productName are ambiguous.

Single Latin names previously had neither a multiword name structure nor the
default Cyrillic prose trigger. Person cues now supply local evidence without
activating aggressive Latin matching across the document. This is a finite
context heuristic, not universal NER; cue-free single names can remain. Generic
heading nouns Stage/Status/etc. are excluded. The `document-person-cue` rule and
replacement `personalLabels` vocabulary can disable the built-in cue rule.
No dependency or optional model is added. Existing value-free debug callbacks
already report document/structured finding counts, and remain off by default.

Self-review found that a whole numeric JSON replacement could seed propagation
inside a separate string with the same digits, producing invalid JSON. Whole
`JSON_VALUE` findings now stay structural and never seed content propagation.
The `numeric-propagation.mjs` probe reproduces the boundary; the issue suite
checks repeated ages/years in both numeric and string values in both engines.
