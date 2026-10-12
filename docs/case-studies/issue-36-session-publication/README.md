# Issue 36: Preserve JSON and code when publishing sessions

Issue: [#36](https://github.com/link-foundation/sensitive-data-sanitizer/issues/36).
Fix: [PR #37](https://github.com/link-foundation/sensitive-data-sanitizer/pull/37).

## Reproduction and baseline

The public, minimized issue examples reproduce on `main` at `ada53fd`. The first
regression run had 63 tests, with 56 failures. It exercised native and
required-engine sanitization, atomic two-pass publication with one/four workers,
literal/key preservation, name recognition, whitespace normalization, Rust
paths, and real escaped credentials.

The bounded native probe produced these results before the fix:

| Input                             | Baseline behavior                   |
| --------------------------------- | ----------------------------------- |
| `name:null` plus a null literal   | `ERR_JSON`                          |
| `nom::{`                          | `ERR_JSON`                          |
| `name=name` plus rate-limit keys  | Code text redacted; streams blocked |
| `name=codec` / `codec::`          | `ERR_RESIDUAL`                      |
| `name:Coding` / `a::coding_`      | `ERR_RESIDUAL`                      |
| `name:Claude` / `name:...`        | Product/schema text redacted        |
| Escaped quote before `Elon Musk`  | `ERR_RESIDUAL`                      |
| Escaped empty cookie header       | `ERR_ENCODING`                      |
| Unfinished `Authorization:` quote | `ERR_FINDING`                       |
| jq expression after `state:`      | Remaining command swallowed         |
| National `tel:` URI, fax, `ĐT`    | Phone numbers unchanged             |

Run the same public fixtures after the fix:

```sh
node --max-old-space-size=512 experiments/issue-36/reproduce.mjs
node --test --test-timeout=30000 tests/sanitizer-issue-36.test.js
node --max-old-space-size=512 experiments/issue-34/session-corpus.mjs
```

No private session data is included. Probe and test logs are saved locally in
`dev/log/issue-36`; the scripts and fixtures are committed for reuse.

## Root causes and fixes

Native and catalog labels shared a value-range helper but accepted arbitrary
tokens after personal name labels. Name labels now require name words: known
given names, multiple capitalized words, or words in scripts without letter case.
Location labels reject expressions and lowercase status identifiers. The catalog
coverage test now supplies actual name/place-shaped samples instead of treating
`private-value` as a person or state. Explicit private values still override
these heuristics.

Structured detection scanned JSON tokens, then document propagation searched
the original raw JSON without restricting the target spans. Propagation now
requires its complete match to fit within a string value. Inferred registry
findings use the `confirmed-personal` rule, so they cannot rename keys and cannot
be mistaken for explicitly configured `knownPersonal` values. Direct detection
of private email/name keys, credentials, and explicitly known private keys
remains supported; collisions still block publication.

The IPv6 syntax checker accepted `::` and `a::b`, which are also Rust syntax.
The heuristic now requires additional address evidence and excludes bare
namespace prefixes. Numeric compressed addresses such as `::1` and ordinary
multi-group IPv6 addresses remain detectable.

Encoded detection checked native findings without applying public policy. It
could therefore emit `ENCODED_SENSITIVE` for a public figure even though recursive
redaction correctly preserved that figure, causing verification to fail.
Decoded native views now apply the same public/fake/propagation policy as direct
inspection. Tests also force private treatment through `publicKnowledge: false`
and `knownPersonal`.

The cookie regex swallowed escaped closing quotes and line delimiters. It now
uses the shared range parser. An unfinished escaped inner quote could also
consume the enclosing JSON quote and produce an invalid or empty finding.
Quoted ranges stop at that enclosing quote, and structured mapping never emits
an empty content span. Tests cover empty headers and nonempty curl headers while
requiring the surrounding command to survive.

Discovery and redaction normalize confirmation values after trimming them.
Matched registry spans and propagated matches do not create new seeds. The
complete second-pass registry accepts additional confirmations without the
one-pass `ERR_LATE_PERSONAL` guard, retains registry/residual limits, and reports
an optional value-free debug event. The whitespace unit test reproduced the
reported mismatch; a separate test checks an additional second-pass confirmation.
One-pass late-confirmation failures and atomic cleanup remain tested.

`tel:` recognizes national numbers and short local dialing numbers. Fax and
Vietnamese `ĐT` labels recognize formatted national numbers, including labels
without a space after the colon. HTML wrappers survive phone redaction.

## Validation

The full local suites passed: Node 1,319 tests, Bun 1,319 tests, and Deno 1,174
tests plus eight steps. Deno used CI's `--allow-read --allow-env` permissions;
filesystem publication paths run in Node and Bun. The focused regression run
passed 238 tests. All four Codex/Claude one/four-worker corpus publications had
valid JSON and zero residual findings. Lint, formatting, duplication, secrets,
syntax, file limits, required documentation, and the version guard passed.

## CI corpus and limits

The existing publication corpus now contains Codex `turn_context` and
`rate_limits` metadata, Claude `attachment.tools`, `wireToolInputs`, and
`toolUseResult` records, all minimized failures, jq commands, and actual escaped
credential/phone values. One/four-worker publications require valid JSON, zero
residual findings, preserved public content and metadata, and removed private
values. The runtime test suite includes independent one-worker cases and a
combined four-worker session to avoid repeatedly starting workers for each tiny
fixture.

The private 911-file corpus from the issue was not supplied, so these results do
not establish a new pass rate for that corpus. Label recognition is a heuristic:
unknown single Latin names and all-lowercase place labels require explicit
`knownPersonal` configuration if needed. Ambiguous Rust-like IPv6 text requires
explicit knowledge when it represents a private address. Two-pass collection
assumes detectors behave consistently for the same input. Byte, record, registry,
worker, required-engine and final verification failures remain fail closed.

A patch Changeset prepares the automatic release without a manual package
version change. npm publication setup remains outside this fix, tracked by #28.
