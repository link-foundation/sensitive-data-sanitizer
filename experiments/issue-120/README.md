# Issue 120 regression evidence

The original configuration is `profile: 'documents'`,
`properNames: 'capitalized'`, `strict: true`. All fixtures are synthetic.
Issue 120 and PR 121 had no comments, reviews or required sub-issues when read.

| Requirement                  | Root cause and implementation                                                                                                                                   | Verification                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Bracketed emails             | Extend the existing finite obfuscated-email separator grammar with `[dot]`, `(dot)` and Russian variants.                                                       | First two reported rows, mixed separators and existing `at`/`собака` forms.              |
| Email local parts            | The existing complete finding was discarded whenever a domain overlapped a proper-name match. Retain complete contacts and identifiers.                         | Third/fourth rows and exact `EMAIL` source spans.                                        |
| Military ID number           | The complete series/number finding was discarded because the series overlapped a proper-name match.                                                             | Fifth row, exact `ID` span and trailing-punctuation control.                             |
| Lowercase employers          | Existing employment grammar required a capitalized name. Add a bounded lowercase word after explicit Russian employment context, preserving known technologies. | Sixth row, feminine verb and technology controls.                                        |
| Cyrillic names before colons | Every colon-adjacent token was exempt. Preserve known Cyrillic labels and non-Cyrillic labels; redact other capitalized Cyrillic words in activated prose.      | Seventh row, spaced colon, known labels, JSON keys and escaped values.                   |
| Strict work durations        | The strict rule understood only immediately adjacent cues without punctuation. Add bounded clause-local duration context and explicit age precedence.           | Eighth/ninth rows, issue-87 duration controls, separate clauses/lines and explicit ages. |
| Parenthesized skill duration | The strict age rule did not check technology context. Reuse the existing technology vocabulary and retain duration context after redaction.                     | Tenth row, Python control, repeated redaction, and `Анна (34 года)` age control.         |

Before source changes, the initial regression suite failed **48 of 65** cases,
including all **30 reported-row/format combinations**. Baseline was `e762a22`.
Failures reproduced the original output, including `ivan собака [REDACTED]` and
`военный билет [REDACTED] 1234567`.

After the fix, all **75** cases in `tests/sanitizer-issue-120.test.js` pass. Each
original row compares exact output in sync and async APIs for text, JSON and
JSONL, and checks idempotence. Extra assertions cover restoration and unchanged
source formatting. The related five-file run passed **502** tests before the
additional boundary/diagnostic and transformation cases were added. Focused ESLint passes with
zero warnings; changed files are formatted with the repository's Prettier.

```sh
node --max-old-space-size=384 --test --test-concurrency=1 --test-timeout=30000 tests/sanitizer-issue-120.test.js
```

`duration-context.mjs` also reproduces a verification-pass interaction:
`работал в ромашке 5 лет` lost the duration after replacing the employer,
while placeholder mode failed with `ERR_PLACEHOLDER_COLLISION` or
`ERR_RESIDUAL` for employer/skill durations. Duration checks now recognize
active personal replacements, including custom placeholders and generated
fake values. Tests cover restoration, sync/async parity and explicit age
precedence after this normalization.

CI on `7433afd` found four existing failures in the Ubuntu Node job
[129151639629](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42614564049/job/129151639629).
The preserved job log reports incorrect redaction of the cue `компании` at
lines 4286/4299 and shifted organization placeholders at lines 4312/4324.
The lowercase employer rule now preserves that cue. All **84** cases in
`sanitizer-issue-100.test.js` pass, as do the **84** combined issue-120 and
placeholder-residual cases. Full cross-platform CI must pass on the final SHA.

The earlier expectation that `Ромашка: менеджер` stays in the issue-106 suite is
updated because issue 120 explicitly requires this behavior to change. Broad
organization spans still cannot merge separate proper-name replacements.
`debug` remains off by default; the new `document-prose-overlap` event contains
only counts. A patch Changeset prepares the automated release without manually
editing version metadata. Full OS/runtime, application and security validation
is delegated to existing GitHub Actions coverage.
