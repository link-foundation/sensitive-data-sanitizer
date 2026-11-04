# Issues 54–56: reversible document anonymization

Investigation date: 2026-11-04. Scope: [#54](https://github.com/link-foundation/sensitive-data-sanitizer/issues/54),
[#55](https://github.com/link-foundation/sensitive-data-sanitizer/issues/55), and the
single-PR parent [#56](https://github.com/link-foundation/sensitive-data-sanitizer/issues/56).
All issue bodies, issue comments, native sub-issues, and PR conversation, review,
and inline-comment endpoints were read. There was no additional feedback at the
initial read. The complete requirement-to-solution inventory is in
[the work plan](../../../experiments/issue-56/PLAN.md).

## Reproduction and root causes

Run `node experiments/issue-56/reproduce.mjs`. Before this change, the issue's
CV example returned `Document findings: []`; selecting `placeholder` threw
`ERR_CONFIG`. These are separate missing features, not failures of an existing
reversible mode. The transformation validator accepts a closed set of modes;
HMAC pseudonyms intentionally discard originals. Organization detection in
`personal.js` requires a preceding context word. There is no employer legal-form,
school-type, or standalone city recognition path.

Existing fake component identity and transliteration helpers offer reusable
name linking. Existing structured projection, scanner union, residual checks,
atomic private writes, and stream identity discovery should remain authoritative.
A registry in each JSONL worker would independently allocate `Person-1` and
produce inconsistent identities, so placeholder processing must be ordered.

## Components and alternatives researched

| Component / primary source                                                                                  | What it provides                                                        | Decision                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Links Notation](https://github.com/link-foundation/links-notation), including its JS package documentation | Parser and formatter for links, quoting and references                  | Use pinned `links-notation@0.30.0`; do not invent an incompatible parser. Its installed npm metadata reports no runtime dependencies. A named link contains the escaped versioned JSON schema, including occurrence metadata.                |
| [Presidio anonymizer](https://presidio.dataprivacystack.org/anonymizer/)                                    | Replacement, encryption/decryption, hashing and custom operators        | Existing detector adapter remains available. A Python service/model dependency is unnecessary for deterministic numbering and is a poor default for this offline JS package. Encryption alone also does not give readable per-type counters. |
| [compromise](https://github.com/spencermountain/compromise)                                                 | English NLP with people, places and organizations                       | Useful optional detector through the existing callback API; its English baseline does not satisfy all 17 locales. Adding it as the default would introduce a second NLP policy without solving multilingual coverage.                        |
| [GeoNames export](https://www.geonames.org/export/)                                                         | Daily worldwide/country geographic extracts under attribution licensing | Broad coverage is possible, but the full extract and update process exceed the requested bounded gazetteer. Use a small authored offline vocabulary instead; no GeoNames dataset is copied.                                                  |
| Existing `nameAliases`, structured projection and atomic writer                                             | Case/transliteration aliases, JSON offsets, private atomic output       | Extend these paths rather than duplicate their encoding, policy and filesystem behavior.                                                                                                                                                     |

Sources were consulted directly; the old Microsoft Presidio documentation URL
currently redirects to the Data Privacy Stack documentation. No network lookup
or model download is introduced into document sanitization.

## Chosen solution and implementation plan

1. Add a shared, per-type placeholder registry with configurable token templates,
   namespace collision checks, alias-aware identity matching, and strict map
   validation. Reuse explicit maps across files and serialized CLI runs.
2. Keep a private versioned JSON/Lino restore map beside the result, never inside
   sanitized text. Store canonical values and exact replacement spans keyed by
   the sanitized document digest. Write maps atomically with mode `0600`, refuse
   marked maps at publication boundaries, and redact credentials unless opted in.
3. Restore complete documents exactly from spans, and restore derived model
   responses in one pass using canonical values. Identical sanitized documents
   with conflicting originals cannot be uniquely inverted; refuse the ambiguous
   operation. Derived responses cannot preserve an original grammatical case.
4. Apply placeholder behavior to sync/async APIs, structured keys and values,
   CLI commands, streaming and bounded file APIs. Record stream positions and
   digests incrementally without buffering the whole file. Run JSONL numbering
   in the coordinator. Discard temporary identity registries in no-map mode.
5. Add opt-in `profile: 'documents'` / `documentEntities: true` detectors for
   legal forms, educational institution types, and bounded city/region names or
   location labels. Give them explicit lower confidence. Preserve public policy
   and private overrides, and provide typed placeholder and fake replacements.
6. Document finite recognition/identity limits and map sensitivity. Add the
   release changeset, focused regression cases, every-locale fixtures and CLI
   permission/reuse tests; validate adjacent behavior and the full CI matrix.

The default and publication profiles do not enable these new document heuristics.
They are intentionally finite rules, not a claim of complete named-entity
recognition or guaranteed anonymity. Proper names without known legal/type/label
cues can remain. Users can supply reviewed `knownPersonal` values or required
external detectors for their own corpus.

## Verification

The new suites cover free-text and JSON/JSONL exact round trips, Cyrillic
inflections/transliterations/initials, cross-file reuse, all three token formats,
both serializations, credential exclusion and opt-in, no-map residual failures,
map publication rejection, private file modes, and stream batch identity/order.
The document suite includes organization, education and location fixtures for
every locale in `localeVocabulary`, both legal-form orders and public/private
policy overrides. Existing transformations, fake output, credentials and JSONL
stream tests supply adjacent regression coverage. PR CI provides the full
Node/Bun/Deno and operating-system matrix.

The first implementation run, [41810210350](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/41810210350),
failed the same package metadata assertion in all nine runtime jobs: the manifest
correctly included the new runnable example, but the test's explicit publication
allowlist had not been updated. In the downloaded log, lines 14801–14814 show
1546 passing Node/Ubuntu tests and this sole failure. Update the allowlist rather
than remove the example or weaken the package-surface assertion.

[CodeQL review](https://github.com/link-foundation/sensitive-data-sanitizer/pull/57#discussion_r4466093659)
also identified repeated regular-expression scanning of unfinished JSON strings
with escaped quotes in the placeholder namespace check. Replace that expression
with a single-pass scanner that skips escaped characters once. A finite 64 KiB
unfinished-string regression and a collision after a 16 KiB JSON literal cover
both linear scanning and the complete input beyond the encoded-detector window.
Custom detector types additionally retain safe token allocation when underscores
normalize to the same readable label.

The corrected implementation at `298706e` passed all nine jobs in
[run 41811037940](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/41811037940).
Node and Bun on Linux/macOS each passed 1551 checks; Windows Node passed 1510
and Windows Bun 1514, reflecting existing platform-specific test selection.
Deno passed 1406 checks plus eight steps on each platform. No runtime job failed.
The same head passed [Security](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/41811038144),
[Example app](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/41811037916),
and [Broken Link Checker](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/41811038022).
CodeQL reports alert 7 as fixed. All 55 new focused tests also passed locally
in Node, Bun and Deno, with the existing Deno filesystem-permission convention.

Final review found no additional native child issues, issue comments or human PR
feedback. The current main is already an ancestor of the prepared branch. The
PR includes a minor changeset, retains all existing transformations and defaults,
closes all three required issues, and is marked ready for review. The last
documentation-only commit records this evidence; current-head checks are verified
before final handoff.
