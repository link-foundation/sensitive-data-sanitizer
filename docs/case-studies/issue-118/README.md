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
