# Reproducible review-corpus comparison

This is a synthetic regression corpus, not a population sample or a market ranking. It combines all named review examples, 17 free-text name fixtures, eight labelled PII fields and one credential field per supported locale, provider/context/encoding examples and 12 benign controls. It was used during development and is not held out. The multilingual labelled fields strongly favor contextual recognizers; English-only default PII baselines and secret-only tools have different intended scopes. No real credentials or personal records are included.

Every engine receives the same plain UTF-8 case files. Gitleaks uses its default release config; TruffleHog disables credential verification and updates. detect-secrets uses its default file-scanning plugins/filters, not the more eager line API. Presidio uses its default recognizers with the explicitly installed English `en_core_web_sm` model and no model downloads; scrubadub uses its default detectors. No competitor is configured with this package's known-value dictionary or language vocabulary. These settings measure the listed defaults, not each tool's best possible configuration.

| Engine            | Version                       | Full spans / 210 | Partial spans | False predictions | Full-span recall | Overlap precision |
| ----------------- | ----------------------------- | ---------------: | ------------: | ----------------: | ---------------: | ----------------: |
| Default sanitizer | Source fingerprint in results |              210 |             0 |                 0 |             100% |              100% |
| Gitleaks          | 8.30.1                        |                3 |             1 |                 0 |            1.43% |              100% |
| TruffleHog        | 3.99.0                        |                3 |             0 |                 0 |            1.43% |              100% |
| detect-secrets    | 1.5.0                         |               26 |             5 |                 0 |           12.38% |              100% |
| Presidio          | 2.2.364                       |               87 |             7 |                51 |           41.43% |            66.45% |
| scrubadub         | 2.0.1                         |               24 |             1 |                 1 |           11.43% |            96.15% |

Full-span recall requires the union of predicted ranges to cover the entire annotated sensitive span. Partial coverage is a miss for recall. Overlap precision counts a deduplicated prediction as true if it intersects any annotated span; it does not penalize excess characters in an overlapping prediction. Therefore neither precision nor these results prove absence of over-redaction. `predictions-*.json` retains UTF-16 ranges for independent review. `results.json` records corpus SHA256, source/lock fingerprint, version pins and counts; `corpus*.json` records the exact synthetic input and truth. Inspect per-case results when comparing secret and PII scopes.

Run from the repository root with Python 3.12, installed binary tools from their official release assets, and finite Node heap:

```sh
npm ci
python3 -m venv /tmp/sanitizer-benchmark
/tmp/sanitizer-benchmark/bin/pip install -r experiments/benchmark/requirements.txt
/tmp/sanitizer-benchmark/bin/pip install https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl
BENCHMARK_PYTHON=/tmp/sanitizer-benchmark/bin/python \
BENCHMARK_GITLEAKS=/path/to/gitleaks \
BENCHMARK_TRUFFLEHOG=/path/to/trufflehog \
node --max-old-space-size=512 experiments/benchmark/run.mjs
```

Use [Gitleaks v8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) and [TruffleHog v3.99.0](https://github.com/trufflesecurity/trufflehog/releases/tag/v3.99.0); verify downloaded release checksums and each tool's version before running. Python package pins and the separate model pin are required. The script cleans its temporary case directory after completion. It runs no credential validation/network lookup; package installation and model/binary downloads require network access. Generated synthetic token JSON is the only benchmark path excluded from repository Secretlint checks; production source remains scanned.

Future comparative claims need larger independent/held-out corpora, native-language models for each baseline, false-positive/over-redaction and failure-rate measurements, and runtime/RSS statistics. Proprietary services were not executed. Their catalog labels and local transforms are implemented from documented interfaces, not their undisclosed classifiers.
