# Issue 118: requirements, alternatives and verification plan

Scope: issues 108–117 in PR 119. All issue bodies, comments and native sub-issue
lists were read. The ten issues have no further sub-issues. PR conversation,
inline comments and reviews are empty at the start. Original issue bodies are
preserved in `experiments/issue-118/issue-*.json`.

## Plan and complete requirement inventory

1. **108 — synchronous detectors:** run array-returning detectors in inspect and
   sanitize on raw, normalized, decoded and decoded JSON value views; preserve
   source offsets; reject thenables with ERR_CONFIG; block detector failures;
   validate results and update types/API.
2. **109 — controls:** publish stable rule ids; validate per-rule and per-type
   booleans; require separate credential-disable permission; support
   `fields: { location: 'scan' }`; preserve defaults; document legacy personal
   recognizers that remain when documentEntities is false; test every issue row.
3. **110 — vocabulary:** additive roles, organization/education cues, personal
   labels/fields; per-list replacement; strict validation; case and Russian-form
   normalization; immutable defaults; bounded compilation/cache; cover all
   examples and unchanged output without additions.
4. **111 — fields:** normalized names (already supported at baseline), exactFields,
   dotted paths and `*` array segments; allowedFields replaces unlisted string
   leaves while scanning listed leaves; preserve keys/numbers/booleans and valid
   JSON/JSONL, including nested containers.
5. **112 — transformations/stages:** global/per-type callbacks; reject sync
   thenables; block throws and residual originals; preserve built-in modes;
   document detect/merge/transform/verify; publish SyncSanitizer and the recipe
   for replacing detection with knownOnly/findings while retaining verification;
   cover text, escaped JSON and async parity.
6. **113 — offline recognition:** separate optional entry for Russian/English
   person, organization, education and location names; no analysis-time network;
   synchronous inference or explicit worker contract; all six positive examples
   and benign controls; public test set, precision/recall per language/type,
   cost per KiB, and no eager core model import.
7. **114 — compiled known values:** immutable reusable compilation and merging;
   retain only caller data; array parity; avoid repeated validation/projection/
   regex compilation; measure 500-entry overhead; document types, Russian forms,
   date/phone variants; URL matches without scheme include query/trailing slash.
8. **115 — catalog:** six contact, seven link, four birthday/age, two identifier,
   five organization/school and three encoded-contact rows; all eight benign
   controls; text/JSON/JSONL parity.
9. **116 — strict opt-in:** eleven attribute and eight bare-value examples;
   common Russian/English health/religion/ethnicity/criminal/political/family
   forms; preserve durations, ISO timestamps, unit-bearing request measurements,
   `Дети: нет`, structural fields and numeric JSON; unchanged when strict is off.
10. **117 — catalog:** patronymics, uppercase initials, mixed scripts, unfamiliar
    given names with surnames; full addresses and numbers, regions, citizenship,
    plates; ten employer and eight school layouts; seven benign controls;
    preserve valueless ОГРНИП; document deliberate bare-name limits; retain
    Romashka Inc behavior.
11. **118 — delivery:** one PR; separate positive closing keywords for 108–118;
    no deferred criteria; release changeset; committed clean branch including
    current main; full diff review; all current-head CI passing; mark ready and
    leave unmerged.

## Sequence and verification

- Research alternatives and reproduce original rows with bounded experiments.
- Draft APIs, policies, field handling and recognizers before focused testing.
- Add regression fixtures for every original row plus structured/async parity.
- Check affected suites locally; leave full platform/runtime matrix to CI.
- Publish measurements and requirement-to-test evidence, update API/COVERAGE/PR,
  inspect failures from saved CI logs, review diff and confirm final SHA checks.

## Primary-source research and alternatives

- [Presidio](https://microsoft.github.io/presidio/analyzer/) supports custom
  recognizers and NLP backends. Its Python bridge cannot run in sync JS hooks.
- [Transformers.js](https://huggingface.co/docs/transformers.js/en/custom_usage)
  supports local ONNX models with remote loading disabled. Models add runtime
  size and async inference, so require an optional offline integration.
- [NLP.js](https://github.com/axa-group/nlp.js) exposes multilingual extraction
  and trim entities; compare it with a bounded native optional recognizer.
- Reuse existing source mapping, field normalization and Russian forms to
  preserve restoration and streaming throughout the codebase.

Implementation decisions, measurements and results will be recorded here.

## Chosen solutions and evidence

| Issue | Alternatives considered and chosen implementation                                                                                                                                                                                                                             | Regression evidence                                                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 108   | A separate sync-only callback option would duplicate configuration. Reuse `detectors`, reject thenables in sync calls, and share normalized/decoded/structured span mapping.                                                                                                  | API suite: text, invisible characters, base64, escaped JSON, exact offsets and failure codes                                                       |
| 109   | Global off switches alone cannot distinguish schema inference from content scanning. Add validated rule/type gates at native and Secretlint emission, a separate credential-disable permission, and field scan policy.                                                        | API suite: all reported overrides, unknown ids, credential guard, location path versus email                                                       |
| 110   | Avoid mutating hard-coded lists or recompiling unbounded expressions per record. Compile additive/replacement lists through a 64-entry bounded cache; retain independent evidence. Reuse existing Russian word forms.                                                         | API suite: all five lists, Russian case endings, replacement, validation and immutable defaults                                                    |
| 111   | Avoid parse/stringify rewriting, which loses source formatting. Extend the existing token walker with root paths and array indices; emit whole-value or string-leaf schema denials.                                                                                           | API suite: case styles, exact mode, nested/wildcard selectors, allowed/denied values, primitive preservation, JSON/JSONL                           |
| 112   | A separate pluggable pipeline object is unnecessary for the requested stages. Extend existing transforms with verified callbacks, expose a reusable SyncSanitizer, and document knownOnly/findings and residual scope.                                                        | API suite: global/per-type, async awaiting, JSON partial escaping, thenables, throws, original/encoded-original leakage and newly introduced PII   |
| 113   | Presidio requires Python; ONNX/Transformers.js adds model/runtime size and asynchronous inference. Choose a separately loaded optional NLP.js symbolic recognizer with finite dictionaries/context rules, synchronous after initialization. No claim of general NER accuracy. | Public 32-row exact-span corpus; six required examples and eight controls; all rows included in per-language/type metrics; bounded cost experiment |
| 114   | Identity-based caching of mutable arrays is unsafe. Return copied frozen arrays with weakly held normalized/compiled metadata; merge only caller data; restore compilation after worker cloning. Extend URL span matching.                                                    | API suite: plain/compiled parity, Russian forms, URL scheme/query/slash, mutation and merge; 500-entry experiment                                  |
| 115   | Reuse existing document and decoding machinery rather than another scanner dependency. Add bounded missing contact/link/birthday/identifier rules and fix confidence normalization for decoded findings.                                                                      | Catalog suite: all original positives and controls, exact full output in text/JSON/JSONL and both engines                                          |
| 116   | Aggressive detection cannot be a safe default for operational logs. Add independent strict opt-in, duration/timestamp/unit guards and structural-string suppression.                                                                                                          | Catalog suite: every original positive/control plus common English attributes, off-switch, structural fields and numeric primitives                |
| 117   | Extend bounded document patterns for names/addresses/employers/schools; keep ambiguous bare names documented. Prevent legal-form substring detection from treating valueless ОГРНИП as a name.                                                                                | Catalog suite: all original cue-based rows, full spans and controls in three formats/both engines                                                  |

The dated arbitrary-role and group layouts already repaired by PR 107 remain
covered by the existing issue-100 tests. No prior feature was deliberately removed.
The integration suite exercises new policies through CLI JSON configuration,
JSONL coordinator callbacks, bounded file callbacks and compiled lists in workers.
Callbacks cannot be transferred by structured cloning, so worker selection keeps
them in the coordinator; explicitly requesting multiple callback workers fails
with ERR_CONFIG rather than losing policy.

### Root causes

Sync methods previously validated `detectors` as a collection but never invoked
them. Structured batches combined string views, which cannot provide a clean
per-value callback contract. Native recognizers had no centralized rule/type gate,
and their document cue vocabularies were closed constants. Transform validation
accepted mode records only. Known-value regexes and projections were rebuilt on
every scan; mutable inputs could not safely be memoized. The catalog misses were
missing bounded forms, plus decoded findings reaching confidence policy before
normalization (email findings without an explicit confidence were discarded).

### Reproducible verification

The original catalog suite run against `origin/main` at `db4f228` failed **92 of
115 tests**, including exact-output catalog mismatches and ERR_CONFIG for the
missing strict option. Reproduce without another dependency install:

```sh
mkdir -p ci-logs/baseline/tests
git archive db4f228 src | tar -x -C ci-logs/baseline
cp tests/sanitizer-issue-118-catalog.test.js ci-logs/baseline/tests/
node --max-old-space-size=384 --test --test-concurrency=1 --test-timeout=30000 ci-logs/baseline/tests/sanitizer-issue-118-catalog.test.js
```

The final focused selections passed **394/394** API/catalog/escape and older
document regression tests, plus **118/118** integration, offline recognition,
17-locale, issue-100 and packaging tests. Public declarations passed Deno checking.
Run the focused selection:

```sh
node --max-old-space-size=384 --test --test-concurrency=1 --test-timeout=30000 tests/sanitizer-issue-118-*.test.js tests/sanitizer-document-entities.test.js tests/sanitizer-issue-100.test.js tests/package-metadata.test.js
node --max-old-space-size=384 --test --test-concurrency=1 --test-timeout=30000 tests/sanitizer-escape-integrity.test.js tests/sanitizer-issue-84.test.js tests/sanitizer-issue-106.test.js
deno check experiments/issue-118/typecheck.ts
node examples/custom-log-policy.mjs
```

[Measurements](measurements.json) and the [public corpus](../../../experiments/issue-118/ner-corpus.json)
preserve the bounded performance and exact-span evidence. The 32-row recognizer
corpus includes challenge misses; its precision/recall is not a population estimate.
Both npm graphs audited during lock regeneration reported zero vulnerabilities.
A minor Changeset prepares the next automatic release, following repository policy.

### CI investigation and integration review

The [first implementation run](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42175107162)
at 90d394d (2026-11-06 06:32:44 UTC) exposed four failures. Preserved Deno logs
identify literal tabs in quoted decoded prose being incorrectly JSON-parsed
(lines 4232–4244), and three older expectations superseded by #115/#117
(lines 4245–4270): English employers, reversed employer roles and inline street
addresses. Only confirmed JSON string spans are now decoded for callbacks;
the older tests assert the newly requested output, including the full apartment.
All four cases pass in the focused regression run.

The [security run](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42175107145)
also reported two `js/polynomial-redos` findings in known-URL normalization
(`src/personal-variants.js`, former lines 148–151). Query/fragment stripping
and trailing-slash stripping now use linear scans. A finite 8192-character
suffix probe is retained in `experiments/issue-118/url-normalization.mjs`.
Additional review tightened custom vocabulary spans to retain trailing prose
and rejects callback output that decodes an encoded original value.

### Delivery checklist

- Implementation, regression tests, public types, examples and API/coverage docs: implemented.
- Current default branch: merged at db4f228 (release metadata only).
- The PR check suite records final full platform/runtime CI for each commit.
  PR 119 records the final diff/comment review and ready state.
