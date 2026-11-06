Current downstream impact on Python 3.15.0: PyPI still serves PyYAML 6.0.3 without cp315 wheels. A resolver restricted to wheel metadata cannot resolve even a hash-locked audit graph:
```sh
uv pip compile --python-version 3.15 --no-build -o requirements.lock requirements.txt
# requirements.txt contains PyYAML==6.0.3 (or a consumer requiring it)
```
With uv 0.13.7 this requires source metadata/build support. Allowing the source fallback resolves our full graph; we commit the reviewed sdist hash and let CI build it on Python 3.15 rather than silently auditing an older Python graph: https://github.com/link-foundation/sensitive-data-sanitizer/pull/103 .

A new PyYAML release containing cp315 wheels (including the wheel-workflow work already discussed here) would remove that source-build exception and restore `--no-build` metadata-only resolution. This adds the audit/resolver use case to the existing wheel-support report; we are retaining the source fallback until the binaries are published.
