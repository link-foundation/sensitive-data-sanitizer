# Issue 146: rule parity, optional verification and requirements audit

Issue: [#146](https://github.com/link-foundation/sensitive-data-sanitizer/issues/146).
Work is preserved in [PR #147](https://github.com/link-foundation/sensitive-data-sanitizer/pull/147).
The PR must remain draft while the unfinished acceptance criteria below remain.
This study does **not** establish completion of issue 146.

[Documentation index](../../README.md) · [Work plan](PLAN.md) ·
[Research and component choices](research/sources.md)

## Requirements and evidence

| ID  | Exact requested scope                                                                                          | Implementation and verification                                                                                                                                                     | Status / remaining work                                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Exactly all rules from all competitors, not less                                                               | Existing native Gitleaks/Betterleaks/Secretlint plus scanner adapters; new isolated Betterleaks adapter, mock subprocess test and real v1.10.0 smoke test                           | **Unfinished.** Regex imports and one smoke test do not prove every rule. Proprietary implementations/models are unavailable; the existing corpus still contains misses.                                                 |
| R2  | Optional provider checks, read-only by default, not irreversible                                               | New `createCredentialVerifier`, disabled by default; twelve fixed HTTPS GET operations, header-only credentials, redirects blocked, response/request limits, no mutation operations | Implemented and mock-tested for the stated catalog. Live availability and all token types are unverified.                                                                                                                |
| R3  | Determine false positives versus actual leaked tokens for all popular services                                 | Separate `valid`, `invalid`, `unknown`, `unsupported`, `disabled` outcomes, without weakening redaction                                                                             | **Unfinished.** Twelve provider contracts are a subset. Paired AWS keys, Azure credentials, self-hosted providers and other token types remain unsupported. Authentication rejection is not a proof of a false positive. |
| R4  | Double-check all requirements from all issues and documentation, deliver them here                             | Paginated snapshots of 114 issue bodies and 114 conversation comments; requirements inventory; issue 144 regression fixes; current corpus rerun                                     | **Unfinished.** A snapshot or closed issue is not a completed independent regression audit. Existing documented gaps and historical requirements must still be verified individually.                                    |
| R5  | README entry point and clear navigation to all docs                                                            | Root README links documentation hub, workflows and API; full case-study index, comparison and legacy navigation                                                                     | Implemented; local link reachability and CI link checks provide verification.                                                                                                                                            |
| R6  | Clearly explain all use cases, why/how to use it and benefits                                                  | New use-case decision guide compares concrete workflows and tradeoffs; current coverage and measured results constrain comparative claims                                           | Implemented for supported workflows. No unsupported claim that this library outperforms every competitor.                                                                                                                |
| R7  | Collect evidence here, deep online case study, every requirement and solution plan, assess existing components | This matrix, raw issue evidence, pinned catalog, before/after measurements, corpus results and primary-source research                                                              | Evidence and plans collected. Full parity investigation and exhaustive historical audit remain unfinished with R1/R4.                                                                                                    |
| R8  | All requested implementation and verification in this single PR                                                | Atomic commits on the prepared issue branch, focused regression tests, CI verification and review                                                                                   | **Unfinished** until all criteria above have evidence; do not mark ready or merge merely because CI passes.                                                                                                              |

Issue 146 has no comments or explicit GitHub sub-issue list at the captured
snapshot. Its prose includes every repository issue. Issue 144 is the other
open issue; its five reported concerns are covered below. The issue/comment
inventory retains historical requirements instead of assuming a closed status
proves satisfaction.

## Root causes and corrections for issue 144

| Reported concern                                              | Cause                                                                                 | Correction                                                                                                                    | Evidence                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 34 special-category expressions escape or become proper names | Missing vocabulary forms and generic type precedence                                  | Add bounded strict attribute forms; prefer attribute evidence over generic person/location/organization guesses               | `tests/sanitizer-issue-144.test.js`: all 34 words in all three frames with exact typed output             |
| Caller attribute loses its typed label                        | Overlapping capitalized-name guess retained its type                                  | Explicit attribute evidence keeps its semantic type; explicit transformation controls retain precedence                       | Capitalized caller vocabulary regression                                                                  |
| Any vocabulary adds repeated per-call work                    | Cache key normalized/serialized default lists repeatedly; cue arrays rebuilt per word | Reuse compiled cue sets and cache by caller identity; use a new object to change lists                                        | `tests/sanitizer-issue-146-attributes.test.js` cache/new-configuration regressions and measurements below |
| Keeping earlier placeholders adds work on ordinary lines      | Repeated namespace construction and full scans                                        | Cache reserved types and skip full matching when no default positive counter can occur; retain escaped/custom-format scanning | Existing, escaped and custom tokens/counter regressions; linear adversarial probe                         |
| Public technology names disappear from Russian prose          | Structural Latin proper-name guesses had no reviewed technology catalog               | Add exact sourced technology entries to public knowledge; credentials and known private values remain protected               | Python/SQL/PostgreSQL/Docker/Kubernetes, private override and person regressions                          |

The new issue 144 regression initially failed four of five tests against the
pre-fix source; all five pass after correction. Additional placeholder/config
regressions also pass. This proves the reported forms and tested policies,
not unrestricted ethnic/religious/health vocabulary coverage.

## A newly reproduced historical regression

The complete competitor probe found two `ERR_RESIDUAL` failures in same-line PEM
and HTML-wrapped PEM fixtures. Issue 132's context-preserving body narrowing
left the end marker adjacent to `[REDACTED]`. The generic template guard treated
its leading hyphen as literal material glued to the mask, then repeatedly
redacted the already masked body until publication failed closed.

`tests/sanitizer-pem-boundary.test.js` fails before correction. Recognizing the
structural end marker for an entirely templated private-key body fixes both
cases. Literal material glued inside the body still requires redaction; armor
and surrounding text stay visible. The focused PEM/context tests pass after
correction. The experiment is `experiments/issue-146/pem-residual.mjs`.

## Pinned Betterleaks evidence

The checksum-verified v1.10.0 Linux archive has SHA-256
`9d9ad503cd5d80d18a939352266c3fcca52f10da9b83cd5cfe646989b13940fe`.
The [resolved catalog](data/betterleaks-catalog.json) has **466** rule records;
45 IDs have no identical native imported ID. An ID shared with the native
imports is not proof that its complete semantics match. The earlier comparison's
474 figure referred to a different `main` snapshot.

`createBetterleaksDetector` executes the installed scanner with its default
config in a private temporary directory. An explicit config overrides environment
config, an empty private ignore directory prevents local suppression, inline
allows are ignored and `--validation=false` prevents live validation. The
existing adapter validates returned offsets and reruns the detector on proposed
output. Missing tools or failures block publication. Native synchronous
behavior is retained, and the binary is never silently installed at runtime.

Reproduce the evidence with an independently installed pinned binary:

```sh
betterleaks config show > /tmp/betterleaks-resolved.toml
python3 experiments/issue-146/catalog-betterleaks.py /tmp/betterleaks-resolved.toml /tmp/betterleaks-catalog.json
node --max-old-space-size=512 experiments/issue-146/betterleaks.mjs /absolute/path/to/betterleaks
```

The recorded smoke result is `upstreamFinding: true` and output
`release_credential=[REDACTED]`. This exercises one real upstream rule and
publication verification, not all 466 rules or all competing scanners.

## Bounded measurements

Node v26.13.0; five interleaved rounds, eight measured calls per variant after
warmup; `--max-old-space-size=512`. Baseline is the parent of `dd1abdf`;
after measurements include the corrected vocabulary/placeholder paths. The
benchmark uses one KB of Russian prose and a short structured JSON record.
Raw [before](data/performance-before.json) and [after](data/performance-after.json)
results are preserved. Reproduce with `experiments/issue-146/performance.mjs`.

| Case / policy            | Before ms/call | After ms/call |
| ------------------------ | -------------: | ------------: |
| Prose, base              |         16.649 |        21.188 |
| Prose, empty vocabulary  |         20.265 |        17.902 |
| Prose, one attribute     |         20.150 |        18.176 |
| Prose, keep placeholders |         17.208 |        16.363 |
| JSON, base               |         10.601 |        10.296 |
| JSON, empty vocabulary   |         11.615 |        10.693 |
| JSON, one attribute      |         13.605 |        10.676 |
| JSON, keep placeholders  |         14.051 |         9.587 |

These small samples are noisy, especially the prose base; they support the
removal of repeated work, not a universal latency guarantee. The old placeholder
precheck also introduced a polynomial regex that CodeQL rejected. A forward
correction uses a linear hyphen/counter test. A finite 1024/4096/16384-character
alphabetic probe completes without namespace scanning; no unbounded stress
experiment is required.

## Corpus and historical audit

The [current corpus results](data/competitor-results.json) retain case indices,
tool, source, outcome and error codes without reproducing matched values.
Run `node --max-old-space-size=512 experiments/issue-146/probe-cases.mjs /tmp/results.json`.
Default configuration still misses positive cases; enabling an external scanner
or strict policy is a distinct configuration and cannot retroactively change
these measurements.

| Default case set       | Total | Skipped | Misses | Over-redactions | Errors |
| ---------------------- | ----: | ------: | -----: | --------------: | -----: |
| Open-source PII        |   371 |       0 |     60 |              16 |      0 |
| Open-source secrets    |   298 |      15 |     15 |              83 |      0 |
| Closed-source examples |   184 |       5 |     41 |              15 |      0 |

Misses include Presidio (23), DataFog (18), Sentry Relay (16), redact-pii (7)
and Lakera Guard (6) examples. These tools cover different domains; passing a
selected public example would still not prove equivalence to a proprietary
model. The per-case source/index list supports targeted continuation instead
of hiding misses in a headline catalog count.

The [requirements inventory](data/requirements.json) preserves all 114 issue
bodies and their 18 conversation comments. The raw repository-wide comments
snapshot also includes PR conversations (114 comments total). [Provenance](data/evidence-provenance.json)
records original response hashes and the replacement of public synthetic webhook
examples with an explicit marker. The source issue URLs retain original text.
[Documentation gaps](research/documentation-gaps.md) list remaining features
explicitly recorded in current comparison pages. This evidence makes R1/R4
falsifiable; it does not turn outstanding requirements into completed work.

## Completion constraints and continuation plan

1. For each public scanner, pin the actual catalog and licensed engine, collect
   positive and negative fixtures per rule, compare detection/offset/decoding
   behavior and resolve each discrepancy. Optional adapters preserve existing
   native behavior but do not meet an unconditional all-rule claim by themselves.
2. Proprietary detector implementations, AI model artifacts or authorized
   equivalent service access are absent. Public labels/descriptions do not
   disclose that behavior. Exact proprietary parity cannot be implemented or
   verified with the available inputs. Record these criteria as blocked instead
   of synthesizing regexes and claiming equivalence.
3. Extend credential contracts provider by provider, including paired credentials
   and scope-specific token families, with documented read operations and mocked
   error/limit tests. Live verification needs authorized test credentials. Current
   twelve-provider coverage leaves R3 unfinished.
4. Review every historical requirement/comment and documented gap individually;
   associate reproducible fixtures, implementation and verification evidence.
   Resolve remaining corpus misses, output/reporting gaps, file/model support and
   conditional policies. An inventory is only the starting point of this audit.
5. Keep the draft PR unmerged and preserve positive closing references in its
   description. Mark ready only after the unfinished criteria are actually met.

## Integration with PR 145

PR 145 merged during this investigation. This branch incorporates its more
precise attribute inflections, broader sourced technology catalog and earlier
placeholder fast paths. Its immutable vocabulary contract avoids repeated getter
reads and serialization; callers must pass a new object when changing lists.
The combined regressions preserve that contract alongside the additional
attribute-precedence, escaped-placeholder, PEM and verifier checks. Earlier
performance snapshots describe the pre-integration draft, not the merged tree.

## CI investigation

- `dd1abdf`: CodeQL rejected the polynomial placeholder precheck; security
  run 42874327704, log line 3503. The linear replacement passed on `b9ae98d`.
- `b9ae98d`: release run 42875250046 rejected two changesets at log line 294.
  Consolidated the PR into one minor changeset. The upstream changeset already
  on main is not a second PR addition.
- `15cd1a0`: link job 130049489191, log line 315, returned HTTP 403 for the old
  OpenAI model-list reference. The current official developer reference was
  fetched successfully and substituted in documentation and provider metadata.

After integrating PR 145, 243 focused tests pass across twelve regression files.
The source changes retain explicit transformation precedence and only strengthen
attribute labeling against the overlapping generic entity types. CI is checked
against the final pushed SHA; no earlier passing run establishes that result.

The new verifier and scanner suites additionally pass on Bun 1.4.4 (11 tests)
and Deno 2.9.7 (10 passed, one explicit subprocess-fixture skip). The verifier
imports `Buffer` explicitly for runtime portability. On `d5b82d4`, CI lint job
130053909276 log lines 352–355 reported unformatted review-snapshot JSON; those
three snapshots were formatted without changing their recorded contents.

On `6df31d1`, runtime run 42880534918 exposed a stale package-file expectation
(Ubuntu Node job 130055950102, lines 5228–5240): the expected allowlist omitted
the four newly published documentation/example files. Ubuntu Bun job
130055950288 also exhausted re2-wasm's fixed 16 MiB heap at line 4900, then
failed subsequent scans. The window-reference tests compiled sixteen duplicate
WASM regex objects outside the shared cache; these objects are never freed.
Those tests now reuse `compiledRule` and explicitly reset `lastIndex` before
reference scans, following the existing all-rules test's allocation policy.
The focused Node package/window/catalog suite passes all 25 tests. A local
full Bun run did not reproduce the CI heap failure; it used Bun's default
five-second per-test timeout and encountered unrelated timeout/environment
failures, so it is not reported as a passing full-suite verification. The
current-SHA CI run must establish whether the duplicate-allocation correction
resolves the heap failure under the original CI test order and budget.

## Merge-conflict restart and newer issue evidence

Main at `2e1be4f` includes PR 155's issue 148 correction. The merge conflict in
`templatedCredential` combined two independently necessary boundary checks:
sentence punctuation after an existing mask and adjacent PEM end armor. Both
are retained. The keyword-window conflict contained the same cache correction
on both branches; the explanatory comment is retained. All 22 tests in
`sanitizer-pem-boundary`, `sanitizer-issue-148` and `sanitizer-gitleaks-windows`
pass on Node after merging.

The older macOS Deno job 130095750047 failed at the fresh-merge step, before
runtime setup. Its preserved local log (`ci-logs/macos-deno-130095750047.log`)
lines 288–296 names those two conflicts and exits with code 1. This is not a
Deno test failure. The latest integration commit requires its own CI results.

Newer [issue 150](https://github.com/link-foundation/sensitive-data-sanitizer/issues/150)
reports `const sessionToken = new SessionToken();` becoming
`const sessionToken = [REDACTED] SessionToken();` in credentials-only mode.
The constructor regression suite from
[PR 156](https://github.com/link-foundation/sensitive-data-sanitizer/pull/156)
fails two tests before correction on this branch. Its implementation and four
tests are integrated with original commit attribution. The contextual detector
recognizes unquoted, case-sensitive `new` followed by a constructor call;
literal credentials, nearby credentials and exact known secrets remain covered.
The added release fragment is consolidated into this PR's single minor changeset.
Issues 148 and 150 had no comments at restart review. This refresh supplements
the historical snapshot; the exhaustive R4 audit remains unfinished.

The final synchronization also integrates main at `75a1a1b` (PR 157, issue 149),
which preserves bounded harmless wrapped binary while inspecting embedded
credentials. All 104 focused encoding, session-identity and constructor tests
pass after the clean merge. The documentation reachability probe identified
the new issue-149 study as unreachable; adding it to the case-study index
restores navigation to all 92 Markdown documents. The preceding merge commit
`ebb89ba` passed all five CI workflows, including all runtime shards; the
new integration requires its own current-head CI verification.
