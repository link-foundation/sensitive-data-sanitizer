# Complete scope, alternatives and solution plans

Parent #24 requires all nine issues and all comments in one PR, individual closing references for #15–#24, and an explicit account of already resolved or unreproducible cases. The original issue bodies and the #21 comment are archived in [issues.json](issues.json). No child issue is excluded. The working plan is [PLAN.md](../../../experiments/issue-24/PLAN.md).

## #15 — Numeric false positives

1. Bare checksum matches must have confidence around 0.3–0.4; nearby identity/health context must raise confidence. Keep low-score findings visible to inspection.
2. Add `minConfidence`/`threshold` with a default that retains ordinary numbers; permit explicitly lower publication thresholds.
3. Require card-network IIN and matching lengths as well as Luhn: Visa, both Mastercard ranges, Amex, Discover, JCB, UnionPay, Mir and Diners.
4. Treat timestamp/ts/time/created_at/elapsed/duration/ms contexts and 2000–2100 epoch-shaped numbers as negatives without identity context.
5. Prefer `PHONE` over NHS/other accidental checks when phone vocabulary/trunk shape supplies evidence.
6. Add a realistic generated log corpus for timestamps, order/run IDs, sizes, ports, PIDs and line:column, and assert a measured false-positive rate in automated tests.

Alternatives: remove checksum detection, lower every checksum score, or combine context and thresholds. Choose the third: shared confidence policy affects native, encoded, external-engine, rendering and residual checks; keep high-confidence structurally specific formats. Card arithmetic remains separately exported; network recognition gates card detection. Match metadata keys at Unicode boundaries so suffixes in ordinary support/report/runtime labels cannot suppress real cards.

## #16 — Credential boundaries and generic dates

1. Accept `auth`, `auth_token`, `x-auth`, `authorization` and reject `author`, `authored`, `authored_by`, `authority`, `authorize_url` as credential keys.
2. Preserve legitimate person detection after `Author:`.
3. Do not redact generic catalog `DATE` alone; retain birth/personal context.
4. Include git log, HTTP and email header negatives and every key negative.

Alternatives: denylist the examples or parse credential key components. Choose component boundaries for auth plus existing multilingual labels. Apply assignment token boundaries in both generic and catalog paths so overlapping catalog findings cannot undo the fix. Exclude generic DATE in the shared catalog recognizer.

## #17 — Remaining identity/contact/span gaps

1. Decide fake status per MRZ document from the document-number field; keep every line of a synthetic MRZ.
2. Recognize published DE specimen `C01X00T47`/`T22000129` and same-record MUSTERMANN/ОБРАЗЕЦ/SPECIMEN markers, preserving ICAO specimens.
3. Never exempt a value merely because surrounding prose says test/fake/example, or let a specimen header exempt adjacent real data.
4. Detect bare Indonesian/Thai trunk shapes with spaces, dashes and parentheses.
5. Support telp, telepon, HP, hubungi, โทร, เบอร์, gọi, SĐT, điện thoại; report PHONE, including VN values that pass NHS.
6. Keep no/number/No./№/# outside identity value spans.
7. Stop unquoted key=value credential spans at whitespace while preserving wider prose syntax.

Alternatives: a strict MRZ parser misses damaged logs; a country-aware phone parser needs country metadata to parse every unlabelled trunk. Choose bounded tolerant native detection, grouped MRZ policy based on document-number evidence, and shared precise value ranges. Use libphonenumber metadata where country codes are needed for generation.

## #18 — Visa and escaped residuals

1. Require a digit and identifier-shaped visa/e-visa value, never an arbitrary word after visa.
2. Make first-pass and residual interpretation agree on escaped JSON values.
3. Test plain, escaped JSON and JSONL versions of both supplied snippets and visa window/application form/Visa card prose.

Alternatives: suppress residual exceptions or fix detection spans/grammar. Preserve fail-closed verification and fix grammar, including name-label word boundaries that let `nameis` be parsed as a label plus verb. Review decoded-engine and structured mapping paths with real sensitive positives.

## #19 — Booking leaks

1. Support bare booking/reservation/PNR/confirmation/бронь plus uppercase 5–8-character references, including airline prose.
2. Propagate confirmed booking values to every occurrence within the input, including filenames and path segments.
3. Recognize airline-prefixed `<Airline>-<PNR>-...` filenames independently.
4. Use confirmed-value propagation for other sensitive identities where applicable.

Alternatives: redact all uppercase short tokens (too many false positives), a filename-only rule (misses paths), or a confirmed-value pass. Choose contextual/filename seeds plus bounded document propagation with Unicode token boundaries. Structured batches must reapply propagation to original document offsets so references cross fields and batches.

## #20 — Names

1. Detect upper-case hyphen/underscore name pairs beside PASSPORT/VISA/ID/PHOTO/SCAN/ПАСПОРТ in filenames, using transliterated gazetteer entries.
2. Detect Russian full names with -вич/-вна/-ична/оглы/кызы patronymics independently.
3. Support Заявитель, ФИО, Applicant, Passenger, Traveller labels.
4. Detect common Latin first+surname pairs case-insensitively, including -ova/-eva/-ov/-ev/-in/-ina/-enko/-sky transliterations.
5. Propagate names confirmed in MRZs/labelled fields into messages, paths and filenames.

Alternatives: a large NER model, broad capitalized-word heuristics, or gazetteer/grammar plus propagation. Choose the last for the offline default, preserving the existing optional Presidio bridge and public-entity policy. Document that a finite gazetteer is not universal NER.

## #21 — Mask/allowlist consistency

1. Start labelled spans after no/no./number:/#/№.
2. Type passport context as PASSPORT_NUMBER and apply identity transforms uniformly.
3. Match fakeValues against precise values and reviewed whole tokens even when a detector returns only a substring; credentials still override reviewed personal exemptions.
4. Decide the four-character case (`pnr: AB12` and passport values): detect strong contextual short values and fully redact under the identity mask minimum.
5. Incorporate the sole comment: fix jointly with #17 rather than separate implementations.

Alternatives: patch masks to remove label text, or repair findings. Choose findings: the same spans then serve masks, allowlists, all transformations, propagation and reporting. Keep existing explicit catalog-type transformations compatible when canonicalizing passport labels.

## #22 — Realistic faking

1. Add keyed deterministic `mode: 'fake'`, stable per key and across equivalent representations/types; changing the key changes output.
2. Names retain locale, script and gender; Russian patronymics remain patronymics. The person agrees across MRZ, prose, labels and filenames.
3. Dates stay valid, retain slash/ISO/dot format, use a keyed shared offset and preserve plausible birth ages.
4. Generate valid ICAO MRZs with individual/composite checks; keep issuer/nationality or optionally use UTO; names and birth/expiry fields agree with other fake fields.
5. Document/national numbers retain pattern/length and valid arithmetic (SNILS, INN, PESEL, Luhn and other implemented validators); prefer published specimen/reserved ranges where available.
6. Phones retain country code, length and punctuation; use NANP 555-01xx and Ofcom drama ranges where available.
7. Emails and domains use reserved example.com/.test destinations.
8. Credentials stay fully redacted by default; explicit opt-in produces provider-shaped, visibly FAKE, intentionally invalid values that do not trigger provider scanner patterns.
9. Generated values are audited as faked and recognized as kept fake by residual/fake policy; never trust unvalidated incoming flags or arbitrary FAKE-looking values.
10. Document pseudonymisation rather than anonymisation: the key stays private, dates/relations/structure are preserved.
11. Test independent MRZ validation, calendar parsing, national checksums, script/gender, determinism/key separation, consistency and removal of original values.

Alternatives: character-class noise, hand-maintained locale dictionaries, Faker, or Presidio's custom faker operators. Choose Faker locale data and per-value HMAC seeds rather than mutable global RNG; libphonenumber-js for country calling-code metadata; native existing checksum arithmetic and an independently maintained `mrz` development dependency for validation. Generated-value provenance stays private to the transform context. Unsupported formats must fall back to full redaction rather than return malformed or unchanged values. Full redaction remains the default.

## #23 — Large sessions and release

1. Document sanitizeStream(source, {structured:'jsonl'}) beside sanitizeJsonl as the path above maxInputLength.
2. Test records around 7 MB, bounded per-record memory and arbitrary byte boundaries, and files above the whole-text limit.
3. Aim for at least 1 MB/s on a finite realistic session JSONL corpus with default detection and residual verification.
4. Parallelize record batches in bounded workers and preserve deterministic output order; handle failures and close workers on completion/cancellation.
5. Publish the merged identity work to npm; downstream installation should work from the registry.

Alternatives: disable required engines, increase whole-file limits, or profile and batch with bounded ordered workers. Choose profiling/batching/workers without disabling default scanners. Use Node worker_threads rather than adding a pool dependency. Provide a reproducible benchmark with finite corpus and memory/stack bounds. Add the repository-prescribed Changeset rather than manually changing package versions.

The existing main release is blocked externally: run 37769979635 at SHA 2306fda, 2026-10-08 11:25:48 UTC, reports an npm OIDC exchange 404 and no NPM_TOKEN bootstrap credential (log lines 151–158). A fresh npm registry query also returns 404. Code cannot mint the npm owner's first-publication credential; preserve the supported bootstrap path and state this external limitation explicitly in the PR rather than claiming publication succeeded.

## Primary research and component comparison

- [Presidio context enhancer](https://github.com/data-privacy-stack/presidio/blob/main/docs/tutorial/06_context.md): contextual evidence changes recognizer scores. Our threshold/context policy follows that model; chance checks alone are weak evidence for ordinary numbers.
- [Presidio anonymizer](https://microsoft.github.io/presidio/anonymizer/): customizable transformation operators; useful through the existing bridge, but Python/service deployment is unsuitable as a required offline JS runtime.
- [ICAO Doc 9303 series](https://www.icao.int/publications/doc-series/doc-9303), [part 3](https://www.icao.int/publications/documents/9303_p3_cons_en.pdf), [part 4](https://www.icao.int/publications/documents/9303_p4_cons_en.pdf): field widths, document/date/optional/composite 7-3-1 check digits. Strict parsing validates generated complete documents; tolerant detection protects damaged fragments.
- [cheminfo/mrz](https://github.com/cheminfo/mrz): maintained JS parser with TD1/TD2/TD3 validation. Use as an independent development-time oracle; it does not locate or safely redact arbitrary log fragments.
- [Faker localization](https://fakerjs.dev/guide/localization) and [randomness](https://fakerjs.dev/guide/randomizer): established locale datasets and seeded generators. Use value-specific keyed seeds so processing order/worker scheduling cannot change a person's fake.
- [libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js): parsing, calling-code metadata, and text location with a default country. Use calling-code parsing for fakes; tolerant format/context recognizers remain necessary for short/damaged national examples.
- [python-stdnum](https://arthurdejong.org/python-stdnum/): many documented national validators, including [PESEL](https://arthurdejong.org/python-stdnum/doc/1.17/stdnum.pl.pesel). Existing JS arithmetic avoids a required Python process; validation does not prove issuance or reserve a number.
- [NANPA fictional numbers](https://nanpa.com/numbering/555-line-numbers): only 555-0100–0199 are reserved fictional line numbers, so use that subrange rather than arbitrary 555 numbers.
- [Ofcom drama numbers](https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/numbers-for-drama): provides geographic and mobile fictional ranges; mobile 07700 900000–900999 informs UK generation.
- [IANA example domains](https://www.iana.org/help/example-domains): example domains are reserved for documentation.
- [Node worker threads](https://nodejs.org/api/worker_threads.html): workers provide CPU parallelism and resourceLimits; an ordered bounded pool can process JSONL without accumulating an entire session. Explicit worker execArgv cannot include parent eval/stdin or V8 sizing flags.
- [Bun Node compatibility](https://bun.com/docs/runtime/nodejs-compat): Bun ignores worker resourceLimits. Document this runtime limitation while keeping bounded byte/queue handling and deadlines; Deno uses an in-process fallback.
- [Deno supply-chain management](https://docs.deno.com/runtime/packages/supply_chain/): Deno 2.9 rejects dependencies published within 24 hours by default. Pin libphonenumber-js to the previously published 1.13.14 release and commit both runtime lockfiles; keep the default policy enabled.

These are format and pseudonymisation mechanisms, not proof that a generated checksummed identity is unassigned. Where no reserved range exists, do not claim an invented value cannot coincide with an issued identity.
