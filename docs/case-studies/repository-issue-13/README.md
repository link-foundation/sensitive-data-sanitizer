# Identity and session sanitization investigation

Repository issue [13](https://github.com/link-foundation/sensitive-data-sanitizer/issues/13)
collects ten requirements implemented together in
[PR 14](https://github.com/link-foundation/sensitive-data-sanitizer/pull/14).
[REQUIREMENTS.md](REQUIREMENTS.md) lists every requirement, possible approaches,
selected implementation, validation and primary research links. Original child
issue descriptions and paginated comments are preserved in `data/`.

## Findings and selected changes

- MRZs were absent from native detection. Country passports, national identifiers,
  travel references and birth dates depended on narrow explicit labels. Added
  bounded shared recognizers, checksum confidence and loose multilingual context.
  Incorrect MRZ checks still redact; generic numeric/document shapes retain
  conservative detection with lower confidence.
- Mask transforms lacked a fixed marker/minimum-length policy. Added those
  options and the identity preset, preserving default complete redaction.
  Specific passport types take precedence over overlapping generic ID catalogs.
- Identity exemptions were unavailable. Added value-only specimen/synthetic and
  exact-reviewed policies, `kept: 'fake'` audit metadata and identical residual
  checks. Known secrets and every credential detector override exemptions.
  A failing overlap regression also showed that a tolerant specimen header
  could cover an adjacent real MRZ data line. Non-fake identity overlaps now veto
  that exemption, while complete official specimens still remain unchanged.
- The encoded scanner threw on ordinary runs longer than 8,192 characters.
  Longer textual base64, wrapped base64 and percent runs now receive bounded
  probes and conservative `ENCODED_LIMIT` whole-run redaction. Opaque non-text
  identifiers retain the old negative behavior; other resource limits remain.
  The UTF-8 probe permits a partial final character without accepting binary
  controls; a regression verifies multilingual payloads beyond the old limit.
- Whole-JSON scanning confused tool metadata with personal/credential context.
  Optional structured scanning batches independent string keys and values and
  maps findings back to exact source offsets. Explicit property declarations
  suppress weak heuristics while strong findings remain. Output is parsed and
  key collisions block publication. Numeric JSON values retain their types.
- Native netrc/NuGet/WordPress/PuTTY v3 formats were missing. Added complete
  credential spans and held multiline netrc/PuTTY records across stream batches.
  Existing Secretlint and Gitleaks detectors remain required by default.
- Messenger phone context did not cover RU/VN/TH/ID national trunk-prefix shapes.
  Added value-only spans and bounded context, including adjacent pipe fields.

Already-covered behavior was retained and regression-tested: explicit UK/Spanish
passport labels, structured Russian birth dates, empty DB_PASSWORD values,
international messenger phones, known-secret priority, required external-engine
verification, worker isolation and atomic stream publication. No child issue is
deferred: these existing pieces are supplemented by the missing formats/options.

## Reproduction and validation

Baseline `npm test` passed 786 tests. The new identity regression suite, run
against archived baseline source, failed 72 tests; shared native rules and option
support then made those reproductions pass. Additional tests cover all five MRZ
layouts, truncated/OCR/reflowed fragments, valid/invalid checksum confidence,
each country, Unicode masks, fake auditing, placeholders, JSON key collisions,
escaped/nested JSON, metadata/credential overlap, bounded file workers and tiny
stream batches. Suites use the existing 30-second test budget.

Final local results: Node and Bun each passed 996 tests, including all 210 new
regressions; Deno passed 851 under its existing read/environment permission
policy. Process/file checks follow the repository's Deno guards and run on
Node/Bun. Lint (including zero warnings on changed code), formatting,
duplication, secrets, syntax, line limits, required docs and release guards pass.
The existing Bun CDN integration briefly timed out once; its isolated retry and
subsequent complete suites passed. Deno's first run exposed missing permission
guards in the new CLI/file tests; splitting the CLI check preserved in-memory
stream/outbound coverage while matching the established test permissions.

## Current-head security investigation

The first published head (`6ac2a2b`, committed at 11:02:27 UTC on 2026-10-08)
passed all workflow jobs but failed GitHub's separate CodeQL alert check.
The Security run `37767481786` began at 11:02:50 UTC on that exact head.
Downloaded logs are preserved in `ci-logs/security-37767481786.log`; lines
4050–4060 show successful SARIF upload/processing, explaining why workflow
success alone did not establish a passing code-scanning gate. The check's three
annotations identified `js/polynomial-redos` in `src/structured.js` at original
lines 10 and 171 and `src/credentials.js` at original lines 22–23.

The [CodeQL query documentation](https://codeql.github.com/codeql-query-help/javascript/js-polynomial-redos/)
recommends removing ambiguous matching or limiting input. A finite probe with
2,000/4,000/8,000 escaped-quote repetitions reproduced the original JSON regex's
quadratic restart behavior. Both lexical passes now share a deterministic
character scanner. Malformed JSON remains blocked by parsing before scanning;
the probe exercises the original pattern directly rather than claiming that
malformed JSON previously bypassed API validation. New tests cover long escaped
quotes, JSON punctuation inside strings and key-like text inside values.

Netrc now reads the password capture from the original triplet match. This also
fixes a reproduced logic bug: a machine named `password` caused the secondary
extraction to mistake the hostname for the field and redact an environment
placeholder. The regression failed before the capture change and passes after
it. All three flagged expressions were removed without disabling queries or
dismissing alerts.

```sh
npm test
bun test --timeout 30000
deno test --allow-read --allow-env
# Restore dependencies before running npm tooling after Deno.
npm ci
npm run check
npm run check:secrets
```

## Bounded performance probes

```sh
node --max-old-space-size=256 --stack-size=4096 experiments/issue-13/session-benchmark.mjs
node --max-old-space-size=256 --stack-size=512 experiments/issue-13/wide-json.mjs
node --max-old-space-size=128 --stack-size=512 experiments/issue-13/codeql-boundaries.mjs
```

On the development Linux/Node 26.11 environment, the finite 300-record,
56,289-byte fixture took 3,269 ms as separate per-value calls and 2,448 ms through
structured batching (1.34×), with approximately 113 MiB RSS. Both include
Secretlint, native detection and residual verification. This is a local corpus
measurement, not a general throughput guarantee; long content can dominate
scanning even after call overhead is reduced.

The 40,000-leaf, 440,001-byte broad JSON probe completed without redactions under
a 256 MiB JS heap and 512 KiB stack, at approximately 133 MiB RSS. Leaf collection
uses iteration and finding mapping uses binary search into ordered entries,
avoiding variadic-stack overflow and a findings-by-all-leaves cross-product.
Existing bounded file workers handle large JSONL sessions record by record.

Research copies, baseline/failure logs, full suite outputs and generated benchmark
results remain in ignored `ci-logs/`. No new runtime dependency is required.
