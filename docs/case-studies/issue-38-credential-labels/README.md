# Issue 38: Keep credential labels inside session strings

Issue: [#38](https://github.com/link-foundation/sensitive-data-sanitizer/issues/38).
Fix: [PR #39](https://github.com/link-foundation/sensitive-data-sanitizer/pull/39).

## Reproduction and baseline

After #37, 129 of 911 real sessions were still blocked by `SECRET/context`
credential-label spans. The minimized public records from the issue reproduce on
`main` at `edb778f`:

| Record                                              | Baseline findings                     | Baseline result      |
| --------------------------------------------------- | ------------------------------------- | -------------------- |
| `sig:' ` followed by `{"type":"","text":""}`        | `sig:' `, then the keys `type`/`text` | `ERR_JSON_COLLISION` |
| `token for ES.\nes u`                               | `u` after the Spanish verb `es`       | `ERR_RESIDUAL`       |
| `SIG for\n:sig is d`                                | `sig is d` across the escaped newline | `ERR_RESIDUAL`       |
| `token for\\ery record. … request-log write lock …` | `-log write lock serio` (verb `est`)  | `ERR_RESIDUAL`       |
| `APIkey="\"private_key:9"`                          | Only `9` redacted in the decoded run  | `ERR_RESIDUAL`       |

The new regression file had 36 tests, with 28 failures on `main`. A seeded fuzz
run over label, verb, quote and escape fragments in JSONL records
(`node experiments/issue-38/fuzz.mjs 3000 1`) blocked 23 of 3,000 records on
`main`: 19 `ERR_JSON_COLLISION` and 4 `ERR_RESIDUAL`.

```sh
node experiments/issue-38/reproduce.mjs
node experiments/issue-38/fuzz.mjs 3000 1
node --test --test-timeout=30000 tests/sanitizer-issue-38.test.js
node --max-old-space-size=512 experiments/issue-34/session-corpus.mjs
```

## Root causes and fixes

The credential prefix in `src/context.js` accepted a qualifier
(`for/от/для/…`) of up to 64 characters other than `:`, `=`, `\r` or `\n`. In
JSON text an escaped line break is the two characters `\` and `n`, so the
qualifier crossed it. The raw scan and the decoded `ENCODED_SENSITIVE` scan then
chose different values. The qualifier now requires whitespace after the
preposition and excludes quotes and backslashes, so it stays on one logical line.

Verbs (`is`, `es`, `est`, …) had no leading word boundary, so `request` ended in
the verb `est`. They are now whole words. `token for ES.` no longer treats `ES`
as a Spanish verb, because a qualifier needs at least one word before the
separator. Generic labels (`token`, `sig`, `sas`, `secret`, `auth`,
`authorization`, `cookie`, `секрет`, `токен`) followed by a verb now need a
generated-looking value: six or more characters with letters and digits, or a
20-character token. `the token is valid` and `sig is d` remain text, while
`sig is 9fA3kQ7zLmP2` and `the token is fixturePrivateToken42` are redacted.
Password-family and compound labels such as `the password is hunter2` and
`api key is …` keep their existing behavior.

An unterminated quoted value (`sig:'`) had no end inside the JSON string, so it
continued across structured batch lines into the following keys. Structured
mapping then redacted those keys, and the duplicate `[REDACTED]` keys caused
`ERR_JSON_COLLISION`. Quoted values are now bounded by the enclosing JSON
string, including strings at the start of a structured batch line, so a value
never includes a JSON key.

For `APIkey="\"private_key:9"`, the credential value and the escaped JSON run
covered the same span. The merge preferred `ENCODED_SENSITIVE`, so redaction
decoded the run and sanitized it without the `APIkey=` label, and only `9` was
masked. A credential covering a whole escaped JSON (`json-content`) run is now
redacted as one value. Self-contained payloads such as base64 are still decoded,
masked and re-encoded under `preserveEncoding`.

Detection and redaction now see the same layers. Residual verification still
runs every enabled engine on the fully masked output, but a value found again is
redacted in up to three more rounds (`residualRounds` in `src/detection.js`)
instead of blocking immediately. The synchronous and asynchronous paths share
`redactAgain`, and each round reports a value-free `residual-redaction` debug
event. Output that does not converge still fails with `ERR_RESIDUAL`, and
structured verification still runs on the final text. The stream identity test
for coordinator findings now expects the fresh verifier's late finding to be
redacted.

## Validation

After the fix, all five reproductions publish. The four prose records are
unchanged and the escaped key assignment becomes `APIkey="[REDACTED]"`. The fuzz
run had zero failures in 3,000 records with seed 1 and in 8,000 records each
with seeds 1, 7 and 99. No fuzz record needed a residual round, which makes the
fixed-point loop a safety net rather than the primary fix. The 36 issue tests
pass through `sanitize`, `createSanitizer().sanitize`, `sanitizeJsonl` and
two-pass and one-pass `sanitizeStreamToFile`. The full suites passed: Node 1,355
tests, Bun 1,355 tests, and Deno 1,210 tests plus eight steps. Lint, formatting and duplication checks passed.

The publication corpus now contains the Codex `payload.content` records and the
Claude `toolUseResult` records from this issue. The corpus asserts that the
prose survives unchanged and that `private_key:9` is removed. All four
one-worker and four-worker publications have zero residual findings. On `main`
the extended corpus fails with `ERR_JSON_COLLISION`.

## Limits

The private 911-session corpus was not supplied, so these results do not give a
new pass rate for it. Generic labels in prose need a generated-looking value: a
short dictionary word after `token is` is treated as text. Use `knownSecrets` to
redact such a value when it really is a credential. Residual rounds are bounded
at three, and a detector that keeps matching its own replacement still fails
closed.
