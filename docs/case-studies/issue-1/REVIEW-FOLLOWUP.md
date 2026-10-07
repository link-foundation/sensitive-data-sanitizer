# Requirements review follow-up

The complete [review](https://github.com/link-foundation/sensitive-data-sanitizer/pull/2#issuecomment-6037262232) is preserved in `research/review-feedback.json`. All 26 named input examples failed against starting commit `60cdd96`; `ci-logs/review-before.log` preserves the local failure evidence. The follow-up adds each as a default async engine fixture in `tests/fixtures/sanitizer-review.js`.

## Complete values and default personal data

The original parser used token-like boundaries for every context. This stopped unquoted prose at spaces/ampersands and quoted JSON at escaped quotes. `src/context.js` now distinguishes quoted values, query parameters, shell assignments/arguments and end-of-line prose/YAML. Nested JSON quote escape depths preserve both JSON layers. Common PASS/PW/PASSPHRASE/CREDENTIALS conventions, prose verbs, Russian inflection and command-specific password flags are supported. Short flags are scoped to programs: mysql `-P` and psql `-p` remain ports.

`src/names.js` provides a bundled, transparent multilingual name gazetteer with script-specific surname grammar; tests exercise 17 locale variants. This provides default free-text name detection without installing Python or a model. It is a baseline with finite vocabulary, not unrestricted statistical NER recall. National-format phones, postal addresses, checksum-validated IBANs, contextual IDs, MACs, messenger handles and Unix/Windows home usernames supplement labelled PII. Unicode decimal-digit views retain original UTF-16 spans.

## Public classification

Built-in exact public names/organizations reference Wikidata entries. Public resolvers reference [Google's addresses](https://developers.google.com/speed/public-dns/docs/using) and [Cloudflare's addresses](https://developers.cloudflare.com/1.1.1.1/ip-addresses/); documentation ranges reference [RFC 5737](https://www.rfc-editor.org/rfc/rfc5737) and [RFC 3849](https://www.rfc-editor.org/rfc/rfc3849). Role emails on an explicit small set of organization domains use a documented heuristic. In particular `press@microsoft.com` passes the review fixture because of the role/domain heuristic; research did not establish a primary-source publication of that exact mailbox. Individual employee mail and unknown domains remain private. This distinction must remain visible rather than presenting a heuristic as verified publication.

Credential findings always override public knowledge. `publicKnowledge: false` opts out; exact `knownPersonal` findings force private treatment. Reviewed `publicEntities` remain explicit caller overrides. Private relationship context such as “patient Albert Einstein” suppresses automatic public-person exemptions.

The execution checklist in `PLAN.md` tracks subsequent rule imports, measured benchmarks, transforms, streaming/outbound integration and history rewriting. No finite corpus establishes universal superiority or parity with undisclosed proprietary models.
