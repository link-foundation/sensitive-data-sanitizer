Confirmed in an actual Ubuntu 24.04 CI run with the current released graph: CPython 3.15.0, presidio-analyzer 2.2.366, spaCy 3.8.18, preshed 3.0.13 and en_core_web_sm 3.8.0. Package installation, `uv pip check` and imports all succeed; the model load fails at `Tokenizer._flush_specials` with `OverflowError: Python int too large to convert to C ssize_t`.

[Failing job with full trace](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42134972915/job/127620684981). The model is the official 3.8.0 wheel with SHA256 `1932429db727d4bff3deed6b34cfc05df17794f4a52eeb26cf8928f7c1a0fb85`.

Minimal runtime reproduction after installing those versions:

```python
import spacy
spacy.load("en_core_web_sm")
```

Our downstream workaround is the current Python 3.14 security release (3.14.10), while preserving the latest Presidio and spaCy releases and their declared dependency constraints. We keep an actual scanner/model-load smoke test in CI rather than treating import success as runtime compatibility. Reproducer: `experiments/issue-102/spacy-load.py` in [PR 103](https://github.com/link-foundation/sensitive-data-sanitizer/pull/103).

Suggested dependency change: replace the unconditional `preshed<3.0.14` cap with an exclusion of the broken release (`preshed!=3.0.14,<3.1` with the appropriate supported lower floor), and verify model loading on 3.14 and 3.15 with 3.0.15. That would let consumers take the fixed wheel without overriding Presidio's metadata. This comment confirms the failing combination; we have not independently tested the 3.0.15 override and are not shipping an incompatible override locally.
