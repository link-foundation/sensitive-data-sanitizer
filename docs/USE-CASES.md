# Choosing a sanitization workflow

[Documentation](README.md) · [API](API.md) · [Coverage and limits](COVERAGE.md)

Use this library when an application needs sanitized text with the original
structure and useful context preserved. It combines credential and personal-data
detection, controlled transformations and a final scan of the proposed output.
A required detector failure blocks publication. That check covers enabled
detectors; it cannot establish universal anonymity.

| Use case                                     | Starting point                                                         | Why this workflow helps                                                                | Main limit                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Share AI sessions or support logs            | CLI `redact --jsonl --stream --two-pass` and `publication` profile     | Preserves records; known identities discovered later can be applied before publication | Review language and detector coverage; stream limits still apply                           |
| Mask credentials in synchronous log hooks    | `/credentials` entry, `createSyncSanitizer({ credentialsOnly: true })` | Avoids personal-data initialization and accidental removal of useful names             | Synchronous hooks cannot run asynchronous external scanners                                |
| Share CVs or narrative documents             | `documents` profile and typed placeholders                             | Keeps relationships readable; a private restore map supports later restoration         | Dictionaries and grammars are finite; unusual names need known values or NER               |
| Sanitize known customers or internal secrets | `compileKnown`, `knownPersonal`, `knownSecrets`                        | Reusable policy supplements detection with exact private knowledge                     | The dictionary/map is itself sensitive and must stay private                               |
| Scan repositories before publication         | CLI scan/pre-commit and [history remediation](HISTORY-REMEDIATION.md)  | Adds findings and bounded, explicit history workflows to review                        | Text scanning does not revoke exposed credentials; rewriting history requires coordination |
| Combine specialist scanners                  | `createSanitizer({ detectors: [...] })`                                | Unions scanner findings and reruns required detectors after transformation             | Install and pin those tools; their failures block publication                              |
| Investigate a suspected leaked token         | [Explicit verification](VERIFICATION.md)                               | Separates read-only authentication evidence from pattern detection                     | Network access is opt-in; invalid/unknown results must remain redacted                     |
| Send sanitized telemetry                     | `createSentryBeforeSend`, `createOutboundSanitizer`                    | Centralizes sanitization before the outbound call                                      | Instrument every relevant outbound path and review payload types                           |

## Selecting a tool

The practical advantage here is combining text rewriting, structured records,
multilingual known values, typed reversible placeholders, fake values and
scanner composition in one JavaScript API. Pure finding scanners such as
Gitleaks or TruffleHog fit repository detection workflows well; their detectors
can also participate here. Presidio supplies configurable language/model-based
recognizers through a local bridge when the built-in grammar is insufficient.

For images, OCR, Office/PDF documents, compressed containers or a managed DLP
service, use a tool designed for that input and connect reviewed text findings
where appropriate. This project does not process those inputs natively. There
is no substantiated claim that it has every competitor's rules or higher
accuracy on every domain. The [comparison](COMPARISON.md), [measured
results](comparison/measured-results.md) and [issue 146 evidence](case-studies/issue-146/README.md)
distinguish shipped behavior from unverified or missing coverage.

## Deployment decisions

1. Define what must be removed, supported languages and acceptable loss of context.
2. Choose the entry/profile and provide private known values when available.
3. Run representative positive and negative fixtures from your own workflow.
4. Review output, retain private restore maps separately and publish only text.
5. If a real credential was exposed, follow its provider's incident procedure;
   sanitizing a copy does not remove previous copies or invalidate the credential.

Follow [best practices](BEST-PRACTICES.md) for operational guidance and the
[runnable examples](../examples/) for API integration.
