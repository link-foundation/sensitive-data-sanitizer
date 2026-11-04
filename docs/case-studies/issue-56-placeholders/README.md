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
