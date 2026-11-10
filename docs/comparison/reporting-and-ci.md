# Reporting and CI integration

[← Comparison overview](../COMPARISON.md). Sources: the per-tool notes in the
[open-source secrets research](../case-studies/issue-128/research/open-source-secrets.md)
(section 2) and the
[closed-source research](../case-studies/issue-128/research/closed-source.md).
Legend: **Y** supported, **P** partial, **–** absent, **?** unverified.

## Feature matrix

| Feature                               | This project                                                       | Gitleaks       | Betterleaks | TruffleHog         | Kingfisher        | Titus | detect-secrets | Secretlint     | Trivy        | Talisman | Presidio        |
| ------------------------------------- | ------------------------------------------------------------------ | -------------- | ----------- | ------------------ | ----------------- | ----- | -------------- | -------------- | ------------ | -------- | --------------- |
| JSON report                           | Y (`scan`, never contains values)                                  | Y              | Y (JSONL)   | Y                  | Y (+ JSONL, BSON) | Y     | Y (baseline)   | Y              | Y            | Y        | Y               |
| SARIF 2.1.0                           | Y (`--format sarif`, `toSarif`)                                    | Y              | ?           | Y                  | Y                 | Y     | –              | Y (formatter)  | Y            | –        | –               |
| JUnit / CSV / template                | –                                                                  | Y              | ?           | –                  | –                 | –     | –              | –              | Y (template) | –        | –               |
| HTML report                           | –                                                                  | –              | –           | –                  | Y                 | –     | –              | –              | –            | Y        | –               |
| GitHub Actions annotations            | P (via SARIF upload)                                               | –              | –           | Y                  | –                 | –     | –              | –              | –            | –        | –               |
| Findings with line and column         | Y (1-based line and UTF-16 column)                                 | Y              | Y           | Y                  | Y                 | Y     | Y (line)       | Y              | Y            | Y        | –               |
| Exact offsets with declared unit      | Y (`utf16`, `codepoint`, UTF-8 `byte`)                             | –              | –           | –                  | –                 | –     | –              | Y (range)      | –            | –        | P (code points) |
| Confidence and likelihood per finding | Y                                                                  | –              | Y           | P (verified state) | Y                 | Y     | –              | –              | P (severity) | P        | Y               |
| Report never includes the secret      | Y                                                                  | P (`--redact`) | P           | –                  | P (`--redact`)    | –     | Y (hashes)     | Y (13.x masks) | Y (masked)   | ?        | –               |
| Several paths in one run              | Y                                                                  | Y              | Y           | Y                  | Y                 | Y     | Y              | Y              | Y            | Y        | n/a             |
| Pre-commit framework hook             | Y (`.pre-commit-hooks.yaml`, 2 hooks)                              | Y              | Y           | Y                  | Y                 | ?     | Y              | Y              | –            | Y        | –               |
| ESLint rule                           | Y (`/eslint-plugin`)                                               | –              | –           | –                  | –                 | –     | –              | P (own linter) | –            | –        | –               |
| Exit code for findings                | Y (1 findings, 2 error or incomplete)                              | Y              | Y           | Y (`--fail`, 183)  | Y (200, 205)      | ?     | Y              | Y              | Y            | Y        | n/a             |
| Incomplete scan is an error           | Y (skipped files make the report incomplete)                       | –              | –           | –                  | –                 | –     | –              | –              | –            | –        | n/a             |
| Import other tools' reports           | Y (Gitleaks, TruffleHog, detect-secrets, Presidio, offset reports) | –              | –           | –                  | Y (viewer)        | –     | –              | –              | –            | –        | –               |

## How to use the features here

```sh
sensitive-data-sanitizer scan src --format sarif > results.sarif
sensitive-data-sanitizer scan $(git diff --cached --name-only) --credentials-only
```

```yaml
repos:
  - repo: https://github.com/link-foundation/sensitive-data-sanitizer
    rev: v0.20.0
    hooks:
      - id: sensitive-data-sanitizer # or sensitive-data-sanitizer-pii
```

- SARIF rules are keyed by `finding.rule`; credential findings are `error`,
  personal findings `warning`; skipped files become tool execution
  notifications ([SARIF reports](../API.md#sarif-reports)).
- `fromGitleaks`, `fromTrufflehog`, `fromDetectSecrets`, `fromPresidio` and
  `fromOffsetReport` turn other reports into findings for redaction
  ([Report adapters](../API.md#report-adapters)).

## Added for issue 128

- `toSarif` and `scan --format sarif` (Gitleaks, TruffleHog, Kingfisher,
  Titus, Trivy and Secretlint all offer SARIF).
- `scan` with several paths and `.pre-commit-hooks.yaml`.

## Remaining gaps

- JUnit, CSV and HTML report formats.
- GitHub Actions workflow-command annotations without SARIF upload.
