# Repository issue 32: requirements, alternatives and evidence

This single PR addresses [#32](https://github.com/link-foundation/sensitive-data-sanitizer/issues/32)
and its six child issues. The original descriptions and paginated comments are
preserved in `data/`. All reported identity values are synthetic. Baseline:
`c9714cb3d86482dea1c0101696f0246be69f4a56`, the merge of PR 25. Research date:
2026-10-10. None of the seven issues had conversation comments during research;
PR 33 had no inline comments, conversation comments or reviews.

## Complete requirement and solution matrix

Each row states the requirement, alternatives considered, and the selected
implementation/verification plan. Earlier delivered functionality remains in
the complete runtime suites; no detector or required engine is removed.

| ID   | Requirement                                                                                                | Alternatives and selected solution                                                                                                                                                                                                          | Verification                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 32.1 | Read all six issues and comments; implement in one PR                                                      | Separate PRs would violate scope. Archive all descriptions/comments and use one cross-cutting change.                                                                                                                                       | Original data and this matrix                                                                      |
| 32.2 | Close every child and parent with individual keywords                                                      | A comma-separated closing list is insufficient. Include `Fixes #26` through `Fixes #32` individually.                                                                                                                                       | PR description                                                                                     |
| 32.3 | Explain already resolved/non-reproducible claims                                                           | Preserve evidence instead of assuming issue diagnoses. Distinguish the observed Windows timeout from the alleged crash.                                                                                                                     | CI investigation below                                                                             |
| 26.1 | Detect two/three name-shaped filename tokens, independently of gazetteer, with `_` or `-`                  | Expanding a finite name list cannot cover unknown people. Use bounded structural token parsing around document words, excluding field-label syntax.                                                                                         | All ten reported filename fixtures                                                                 |
| 26.2 | Support PASSPORT, VISA, ID, PHOTO, SCAN, ПАСПОРТ, ВИЗА, СКАН, ФОТО, either order/case                      | A suffix-only regex misses prefixes. Check both neighbors of each case-insensitive document token.                                                                                                                                          | Lowercase document-first, Cyrillic, three-part Vietnamese and hyphenated cases                     |
| 26.3 | Detect capitalized/all-caps Slavic surname pairs in either order, including Cyrillic                       | Requiring a gazetteer hit repeats the defect. Add bounded given-name grammar plus all requested surname suffixes.                                                                                                                           | Every prose example, uppercase variants                                                            |
| 26.4 | Cover Aleksei/Alexei/Alexey/Aleksey and Olesya/Olesia systematically                                       | Isolated spellings do not scale. Generate table-derived aliases for the Cyrillic gazetteer, including common `ks`/`x` spellings.                                                                                                            | Requested variants and cross-script propagation                                                    |
| 26.5 | Carry confirmed private identities from MRZ, labels and strong rules across stream batches                 | Caller-managed `knownPersonal` cannot discover session identities. Maintain a private registry in the coordinator and send snapshots to workers.                                                                                            | Workers 1/4, supplied engine, plain stream, 1.7 MB session                                         |
| 26.6 | Bound registry and prevent disclosure in logs/metadata                                                     | An unbounded plaintext token history costs memory/privacy. Store prior unredacted tokens as per-stream HMAC digests; keep confirmed values private; fail on finite limits.                                                                  | Registry exhaustion/initial-value limits, per-stream isolation, existing value-free metadata tests |
| 26.7 | Handle late confirmation by two passes or fail closed                                                      | Two passes require replayable input. Select `ERR_LATE_PERSONAL`; atomic file and CLI publication remove staging and expose no completed output.                                                                                             | Early filename/late label, low-score numeric/late passport, ToFile cleanup                         |
| 26.8 | Propagate Cyrillic and ICAO/GOST/common passport forms in both directions                                  | A general slug library cannot supply all passport mappings. Use bounded explicit table aliases and inverse candidates. These are detection aliases, not identity proof.                                                                     | Cyrillic label → Latin path and Latin MRZ → Cyrillic path                                          |
| 27.1 | Valid formatted SNILS `ddd-ddd-ddd dd` and `ddd ddd ddd dd` score ≥0.85 bare                               | Lowering all defaults would increase numeric coincidences. Give checksum-valid distinctive shapes 0.99.                                                                                                                                     | Both shapes and reported SNILS values                                                              |
| 27.2 | Valid 12-digit personal INN exceeds default threshold; bare 10-digit INN stays low                         | A Russian-language-only boost is narrower. Use 0.99 for two-check-digit personal INN; retain 0.35 for bare organizational INN.                                                                                                              | Both personal examples, existing numeric negatives                                                 |
| 27.3 | Add пенсионное, страховое свидетельство, СНИЛС, страховой номер                                            | A separate detector would diverge between APIs. Extend shared national context vocabulary.                                                                                                                                                  | Compact SNILS under every context                                                                  |
| 27.4 | Assert confidence for each national-ID shape; document effective defaults                                  | Replacement-only tests can miss a future threshold regression. Retain full country score tests and update changed SNILS/INN expectations.                                                                                                   | Identity boundary suite and COVERAGE.md table                                                      |
| 28.1 | Configure release prerequisites and first npm publish; version/install/npx smoke                           | Bootstrap publishing needs npm authority unavailable here. Preserve strict release preflight, prepare a Changeset, document exact owner steps, and test packed installation locally.                                                        | Registry 404, no repo secrets, local npm ENEEDAUTH; publication remains blocked                    |
| 28.2 | Reproduce/fix or identify Bun Windows failure; no retry workaround                                         | Full retained logs identify a deadline failure, not a crash. Separate Node child startup readiness from bounded matching time; retain original workload and matching-time assertion.                                                        | Log lines below, Node/Bun/Deno and fresh Windows CI                                                |
| 28.3 | Build succeeds when Pages disabled; deploy only if configured                                              | Enabling repository settings needs owner access. Query Pages, skip configure/upload/deploy on 404 or legacy build, retain normal web build artifact. Other API errors fail visibly.                                                         | Pages configuration tests and workflow CI                                                          |
| 28.4 | Main CI green after merge; PR checks should reveal release conditions                                      | Existing preflight already runs in advisory PR mode and strict main mode. Do not make missing publishing authority appear successful. Document that main cannot be verified before merge/configuration.                                     | Fresh exact-head PR runs; strict preflight blocker retained                                        |
| 29.1 | Public catalog/verifier takes precedence for Sergey Brin, Pavel Durov, Vladimir Putin and earlier examples | Disabling name rules would leak private people. Add independently sourced public catalog entries and retain sensitive-context/private/credential overrides.                                                                                 | All ten public fixtures, private namesake and known-secret precedence                              |
| 29.2 | Uppercase dictionary/log words are not booking references; plausible PNRs remain                           | Requiring a digit rejects legitimate alphabetic PNRs. Retain shaped codes but exclude FAILED, ERROR, HTTP, PENDING, OK, CANCELLED, CONFIRMED and other common status words.                                                                 | Reported negatives and existing travel identifier suite                                            |
| 29.3 | First name followed by Bay/Sands/Hotel/Street is not a person alone                                        | A place NER dependency is heavy for these precise rules. Apply place-word guard to gazetteer and structural pair rules.                                                                                                                     | Marina Bay Sands and each place-word guard                                                         |
| 29.4 | Fake phone preserves type and uses fictional ranges where available                                        | Random country-prefix preservation produces impossible mobiles. Preserve RU mobile prefixes; choose NANP 555-01xx and Ofcom mobile/fixed/freephone ranges; validate other international types with full phone metadata and bounded retries. | Country/separator/determinism tests, fixed/mobile reserved ranges                                  |
| 29.5 | Preserve verified fake MRZ/date/SNILS/name/email behavior and credential full redaction                    | Replacing faker would risk prior guarantees. Keep existing generators/provenance and adjust only phone generation.                                                                                                                          | Complete existing fake suites                                                                      |
| 30.1 | Valid real-shaped JSONL no longer hits reported ERR_JSON/ERR_RESIDUAL                                      | Weakening verification would hide leaks. Fix label ranges and expand replacement endpoints to whole escape units.                                                                                                                           | Both exact minimal reproductions                                                                   |
| 30.2 | Never split `\\n`, `\\t`, `\\"`, `\\uXXXX` in plain or structured mode                                     | Re-serializing all JSON loses byte/offset behavior. Align spans in the shared rendering path while preserving source offsets and whitespace.                                                                                                | Arbitrary engine spans inside every escape, nested credential content                              |
| 30.3 | Address/state only plausible same-line values; reject newline and single letters                           | Catalog-only patch misses native labels. Share plausibility guard between both label systems; prohibit vertical whitespace in catalog separators.                                                                                           | Escaped/actual newline state and real-shaped session fixtures                                      |
| 30.4 | Corpus covers Claude/Codex nested records, diffs/test output, sanitizeJsonl, workers 1/4 and ToFile        | Testing only minimal strings misses container behavior. Include all containers and publication modes in runtime tests.                                                                                                                      | Session, escape and stream publication suites                                                      |
| 30.5 | Verify throughput after successful sanitization                                                            | Unbounded stress could exhaust the host. Use a finite corpus, bounded worker heap/stack and validation of every output record.                                                                                                              | Reusable experiment and validation record                                                          |
| 31.1 | Document `profile:'publication'`, threshold 0.3, identity masking and strict defaults                      | Globally changing API defaults breaks inspection callers. Add explicit profile to sync/async APIs and declarations; default CLI redact to it, honoring explicit options.                                                                    | Bare passport, SNILS, INN and CLI/config tests                                                     |
| 31.2 | English series and number/passport series/document number act like Russian labels                          | Three CLI-only aliases would leave API leaks. Extend shared passport context vocabulary.                                                                                                                                                    | All three contexts, both Russian passport formats                                                  |
| 31.3 | Publish package/version requirement                                                                        | Duplicate of 28.1: one release trigger and one candid blocker report. Manual package version edits violate contributing policy.                                                                                                             | Changeset and packed CLI smoke                                                                     |
| 31.4 | Function calls, identifiers and property accesses after username labels remain code                        | Rejecting all username labels loses personal values. Skip unquoted code declarations/calls/properties in both native and catalog paths.                                                                                                     | const userName = getUserName()/user.name/existingUserName; existing literal-label coverage         |
| 31.5 | Preserve all listed delivered capabilities                                                                 | Removing earlier rules would conceal regressions. Run the complete suites including MRZ/OCR, travel/path, masking/fakes, ID/TH phones, timestamps/order IDs, git/HTTP headers and deterministic typed fakes.                                | Full local and CI suites                                                                           |

## Root causes and codebase reach

Filename recognition depended on gazetteer spellings; reverse-order surname
pairs were absent. Propagation state existed only inside one inspection call.
Streaming workers processed independent batches. The new coordinator registry
feeds serial engines and ordered worker snapshots; supplied package sanitizers
are recreated with their original options plus shared state. Custom engines
retain their result and receive the package's required verification pass.

The numeric-policy change treated distinctive formatted SNILS and personal INN
like weak checksum coincidences. Shared national scoring now distinguishes
those forms. The publication profile is applied before configuration validation
in synchronous and async APIs; CLI redact defaults to the same profile.

Native and catalog label recognizers disagreed about newline/code values.
Catalog separators used vertical `\s`, and raw JSON escapes could form partial
name matches whose propagated components cut the initial escape. Shared label
plausibility and complete escape alignment fix the original cause without
disabling residual verification. `redact`, native sanitize, async engines,
structured batches, workers, file publication and CLI all use these paths.

The throughput probe exposed an additional whole-document leak: a confirmed
name was forgotten while recursively sanitizing a later encoded string that
also contained a credential. Recursive engine calls now carry document
confirmations. Encoding wrappers themselves never become identity seeds;
otherwise a decoded MRZ could incorrectly request another encoding operation.
The existing escaped-MRZ test and a new credential-containing-string regression
cover both behaviors. Escape alignment visits each endpoint once after sorting,
even when many findings overlap.

Streaming initially repeated a full native/required inspection before registry
preparation and sanitization. A private one-batch prepared-findings cache removes
that duplicate in serial streams. Parallel workers reuse the coordinator's
native findings and still merge required-engine results under the same policy.
Final residual verification always runs native and required engines again;
coordinator results never substitute for output verification. Both the existing
7 MiB parallel-record and 10 MiB publication tests keep their 30-second timeout;
no required detector is removed to improve throughput.

Final review reproduced late confirmation gaps for compound usernames and
multiword addresses. The HMAC history check now includes their word components;
it deliberately fails conservatively if a component was already emitted. GOST diacritics also receive reverse aliases; the final requirement audit first reproduced and then fixed this gap. A separate regression ensures the registry applies the publication threshold
before scoring confirmations, so an already protected bare passport does not
cause a false late-confirmation failure when its label appears later.

## Primary-source research and existing components

| Component/source                                                                                                                                                                            | Relevant capability                                                                                           | Decision                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Microsoft Presidio](https://microsoft.github.io/presidio/supported_entities/)                                                                                                              | Pattern/context/checksum recognizers and optional NLP for people/places                                       | Existing detector/Presidio bridge remains available; installing models is unnecessary for the reported deterministic rules.                               |
| [cyrillic-to-translit-js](https://github.com/greybax/cyrillic-to-translit-js)                                                                                                               | Lightweight bidirectional Cyrillic transliteration                                                            | Useful general converter, but exact passport/GOST alternatives need explicit tables and bounded ambiguity. No new runtime dependency.                     |
| [ICAO Doc 9303 Part 3](https://www.icao.int/publications/documents/9303_p3_cons_en.pdf)                                                                                                     | Transliteration convention for machine-readable travel documents                                              | Basis for passport aliases; irreversible spelling is not public/private identity verification.                                                            |
| [ISO 9 standard](https://www.iso.org/standard/3589.html), [national standards-body preview](https://preview.sist.si/sist-preview/3589/f4e0fd29303b445fbffcc9093fbf0a22/SIST-ISO-9-2005.pdf) | Cyrillic transliteration with diacritics and reverse conversion                                               | Extend the bounded inverse tables to Latin diacritics; regression covers Malyševa → Малышева.                                                             |
| [python-stdnum INN implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/ru/inn.py)                                                                              | Independently documented 10-digit company and 12-digit personal check-digit arithmetic                        | Research/checksum oracle; keep existing native implementation, no Python runtime dependency.                                                              |
| [libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js)                                                                                                                    | Full `/max` metadata supplies validity and number type                                                        | Reuse installed pinned library for plausible international fakes.                                                                                         |
| [NANPA fictional line numbers](https://www.nanpa.com/numbering/555-line-numbers)                                                                                                            | 555-0100–0199 reserved for entertainment/advertising                                                          | Retain NANP fake range.                                                                                                                                   |
| [Ofcom drama numbers](https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/numbers-for-drama)                                                                                        | Separate mobile, London, geographic and freephone ranges                                                      | Preserve number type when selecting fictional UK fakes.                                                                                                   |
| [Microsoft jsonc-parser](https://github.com/microsoft/node-jsonc-parser/blob/main/README.md)                                                                                                | Scanner/tree offsets and edit operations                                                                      | Viable replacement parser; retain existing strict JSON.parse validation and lexical mapping to preserve whitespace/duplicates and avoid permissive JSONC. |
| [Bun child-process docs](https://bun.com/docs/runtime/child-process)                                                                                                                        | Node child-process compatibility and IPC                                                                      | Use import-complete child readiness; no runtime retries or relaxed matching bounds.                                                                       |
| [GitHub Pages REST API](https://docs.github.com/en/rest/pages/pages#get-a-github-pages-site)                                                                                                | Site configuration reports workflow/legacy source and absent-site 404; fine-grained tokens require Pages read | Explicit read permission and conditional deployment; keep permission/server failures visible.                                                             |
| [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/)                                                                                                                        | Repository/workflow-bound OIDC authentication                                                                 | Requires owner setup and supported Node/npm; cannot be established from this workspace.                                                                   |
| [npm staged first publication](https://github.blog/changelog/2026-10-02-npm-staged-publishing-now-supports-creating-new-packages/)                                                          | New packages can now be created by staged publish and owner approval                                          | Corrects the assumption that only an old automation token can bootstrap a package; owner approval is still required.                                      |

Public catalog additions link their Wikidata entities in `src/public.js`:
Sergey Brin [Q92764](https://www.wikidata.org/wiki/Q92764), Pavel Durov
[Q149067](https://www.wikidata.org/wiki/Q149067), Vladimir Putin
[Q7747](https://www.wikidata.org/wiki/Q7747). Public exceptions never authorize
credential retention or erase a confirmed private namesake.

## CI investigation and external publication blocker

Complete main-run logs were downloaded into ignored `ci-logs/`, with timestamps
and exact head SHA checked first. Both reported runs began 2026-10-08T19:17:05Z
at baseline `c9714cb`; earlier failed runs 37769979635/37769979827 were also
retained. Full logs are large; analysis used numbered chunks of at most 1500
lines.

- [Checks and release 37830784369](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/37830784369):
  retained `release-37830784369.log` lines 152/160 show npm OIDC exchange 404 and
  refused release; lines 7445–7452 identify the _finite hostile whitespace_
  test at 2499.65 ms, 1074 passed / 1 failed, 1075 total across 83 files. The
  suite finished in 95.89 seconds. This contradicts the issue's crash diagnosis.
- [Example app 37830784426](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/37830784426):
  retained `example-37830784426.log` lines 1510–1511 show Pages GET 404; line
  1731 reports failure. Current Pages GET still returns 404.
- Current registry lookup returns npm E404 for the scoped package; repository
  secret-name listing is empty; `npm whoami` returns ENEEDAUTH. No credential
  contents were printed. A local packed install proves package integrity but
  cannot prove an unavailable public registry release.

The Windows test previously gave dependency import, process startup and actual
matching a single two-second deadline. It now signals readiness after imports,
allows a finite 15-second startup deadline, then enforces the original two-second
probe deadline and sub-second matching assertion. Input is still finite with a
128 MiB Node heap and 1024 KiB stack. This isolates the measured work without
retrying tests or increasing a pathological regex's time allowance.

### Exact npm owner steps

1. An npm owner with publishing authority for the `@link-foundation` scope must
   create the package. Use a short-lived granular access token with appropriate
   write permission and the supported 2FA bypass for CI bootstrap, or use the
   newly supported `npm stage publish --access public` route and approve it with
   owner 2FA. Consult current npm staged-publishing documentation for account
   eligibility. This workspace has neither publishing authentication nor owner
   approval capability.
2. On the package's npm Settings → Trusted publishing, choose GitHub Actions:
   organization/user `link-foundation`, repository `sensitive-data-sanitizer`,
   workflow filename **`release.yml`**. Leave environment blank unless the release
   job is deliberately configured with the exact same named environment.
3. Check the publisher's publish policy. Current new configurations default to
   staged publishing; explicitly permit direct publishing if retaining this
   workflow's direct `npm publish` behavior. Complete the initial trusted publish
   within npm's documented setup window, or refresh the configuration.
4. If using bootstrap credentials for the existing workflow, set its `NPM_TOKEN`
   repository secret securely; never commit or print it. Keep strict preflight.
   OIDC needs a GitHub-hosted runner, `id-token: write`, supported npm ≥11.5.1 and
   Node ≥22.14, and the matching repository URL already present in package.json.
5. Merge through PR 33 after review/configuration, then run `release.yml` through
   its existing release mechanism. The Changeset prepares the next version; a
   manual package.json version edit would fail repository policy.
6. Verify `npm view @link-foundation/sensitive-data-sanitizer version`, a fresh
   install, and `npx @link-foundation/sensitive-data-sanitizer --version`. Confirm
   the post-merge run's timestamp and SHA. Until these succeed, first npm
   publication and green main release CI remain explicitly undelivered.

Pages deployment is optional: Settings → Pages → Source → GitHub Actions enables
it. The PR handles the current disabled state while continuing to build and
upload the example app. It does not alter repository owner settings.

See [VALIDATION.md](VALIDATION.md) for completed checks and observed limits.
