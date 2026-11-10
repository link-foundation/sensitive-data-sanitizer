# Extensibility

[← Comparison overview](../COMPARISON.md). Sources: rule and recognizer
formats in the
[open-source secrets research](../case-studies/issue-128/research/open-source-secrets.md),
[open-source PII research](../case-studies/issue-128/research/open-source-pii.md)
and [closed-source research](../case-studies/issue-128/research/closed-source.md).
Legend: **Y** supported, **P** partial, **–** absent, **?** unverified.

## Feature matrix

| Extension point                        | This project                                                         | Gitleaks / Betterleaks  | TruffleHog           | Kingfisher                 | detect-secrets | Secretlint    | Presidio                | OpenRedaction | LLM Guard    | Google SDP          | Nightfall    |
| -------------------------------------- | -------------------------------------------------------------------- | ----------------------- | -------------------- | -------------------------- | -------------- | ------------- | ----------------------- | ------------- | ------------ | ------------------- | ------------ |
| Declarative regex rules                | Y (`createPatternDetector`)                                          | Y (TOML)                | Y (YAML custom)      | Y (YAML, Betterleaks TOML) | –              | Y (`pattern`) | Y (`PatternRecognizer`) | Y             | P            | Y (custom infoType) | Y            |
| Hotwords with window and boost         | Y (`context`, `contextWindow`, `contextBoost`)                       | P (keywords prefilter)  | P (keywords)         | P                          | –              | –             | Y                       | Y             | –            | Y                   | Y            |
| Deny list (dictionary) rules           | Y (`denyList`, `knownPersonal`, `knownSecrets`)                      | –                       | –                    | –                          | –              | –             | Y                       | ?             | Y            | Y                   | Y            |
| Validation callback per rule           | Y (`validate`)                                                       | P (Expr filters)        | Y (Go code, webhook) | P (checksum filters)       | Y (plugins)    | Y (code)      | Y (`validate_result`)   | ?             | –            | –                   | –            |
| Checksum validators exposed for reuse  | Y (`identifierChecks`, `tokenChecksum`, `luhn`)                      | –                       | –                    | Y (built-in filters)       | –              | –             | P (internal)            | ?             | –            | –                   | –            |
| Code detectors (any engine)            | Y (`detectors`, sync or async)                                       | –                       | Y (Go)               | –                          | Y (Python)     | Y (JS rules)  | Y (`EntityRecognizer`)  | –             | P            | –                   | –            |
| Replace or disable built-in rules      | Y (`rules`, `types`; national rules via `createIdentifierDetector`)  | Y                       | Y                    | Y                          | Y              | Y             | Y                       | ?             | Y            | P                   | Y            |
| Bridges to other scanners              | Y (Gitleaks, TruffleHog, Presidio, Secretlint)                       | –                       | –                    | P (imports reports)        | –              | –             | P (transformers, spaCy) | –             | P (Presidio) | –                   | –            |
| Import other tools' reports            | Y (Gitleaks, TruffleHog, detect-secrets, Presidio, offset reports)   | –                       | –                    | Y (viewer)                 | –              | –             | –                       | –             | –            | –                   | –            |
| Local ML NER                           | P (optional `@nlpjs/ner` subpath, Presidio bridge)                   | –                       | –                    | –                          | P (gibberish)  | –             | Y                       | –             | Y            | n/a                 | n/a          |
| Per-type transformation callbacks      | Y (`transformations`, callback stages)                               | –                       | –                    | –                          | –              | –             | Y (custom operator)     | –             | –            | P                   | –            |
| Caller vocabulary and fake-value pools | Y (`vocabulary`, `pools`, `fakeValues`)                              | –                       | –                    | –                          | –              | –             | –                       | ?             | –            | Y (dictionary)      | –            |
| Named configuration profiles           | Y (`publication`, `documents`; JSON config)                          | Y (config file)         | Y (config file)      | Y                          | Y              | Y (rc file)   | Y (YAML)                | Y (presets)   | Y            | Y (templates)       | Y (policies) |
| SDK hooks for outbound data            | Y (`createSentryBeforeSend`, `createOutboundSanitizer`, ESLint rule) | Y (Go SDK, Betterleaks) | –                    | Y (Rust, Python, Node)     | –              | Y (Node)      | Y (Python)              | Y (Node)      | Y            | Y (SDKs)            | Y (SDKs)     |
| Debug tracing without values           | Y (`debug` callback)                                                 | P (log level)           | P                    | P                          | –              | –             | P                       | ?             | ?            | –                   | –            |

## How to extend here

```js
import {
  createPatternDetector,
  createIdentifierDetector,
  identifierChecks,
  nationalRules,
  sanitize,
} from '@link-foundation/sensitive-data-sanitizer';

const ticket = createPatternDetector([
  {
    type: 'TICKET_ID',
    category: 'personal',
    patterns: [{ regex: /\bCASE-\d{6}\b/g, confidence: 0.4 }],
    context: ['ticket', 'case'],
  },
]);
const extra = createIdentifierDetector(
  nationalRules.filter((rule) => rule.type === 'PL_PESEL')
);
sanitize(text, { detectors: [ticket, extra] });
```

- Detector contract: `detect(text)` returns `{start, end, type, category,
rule}` with UTF-16 offsets ([Required detectors](../API.md#required-detectors)).
- Bridges: `createGitleaksDetector()`, `createTrufflehogDetector()`,
  `createPresidioDetector()`; the asynchronous `createSanitizer()` always runs
  the pinned Secretlint preset ([combined scanners example](../../examples/combined-scanners.mjs)).
- Policies: `rules`, `types`, `fields`, `allowCredentialDisable`
  ([Rule, type and field policy](../API.md#rule-type-and-field-policy)).
- Transformations: per-type callbacks and stages
  ([Callback transformations and stages](../API.md#callback-transformations-and-stages)).
- Vocabulary: `vocabulary`, `defaultVocabulary`, `documentVocabulary`
  ([Caller document vocabulary](../API.md#caller-document-vocabulary)).

Every component the sanitizer uses is replaceable through these options; the
built-in engines are defaults, not requirements, except that credential
detection cannot be turned off without `allowCredentialDisable`.

## Added for issue 128

- `createPatternDetector` (Presidio `PatternRecognizer`, Google custom
  infoTypes with hotword rules, Nightfall custom detectors).
- `createIdentifierDetector` and `identifierChecks` (national rules can be
  added or replaced).
- `tokenChecksum` and `tokenWithChecksum` (Kingfisher checksum filters).
- 203 Betterleaks rules vendored with a sync script
  (`scripts/sync-betterleaks.py`), next to the Gitleaks sync.

## Remaining gaps

- Loading Gitleaks or Betterleaks TOML rule files supplied by the caller at
  run time (the vendored rules are compiled at build time; custom rules use
  `createPatternDetector`).
- Betterleaks Expr filters (`tokenRatio`, `components`) are not interpreted.
- Rule packs from secrets-patterns-db are not imported (CC-BY-SA-4.0
  share-alike licence).
