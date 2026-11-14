---
'@link-foundation/sensitive-data-sanitizer': patch
---

Preserve NUL separators and subsequent log fields when redacting credentials with `--allow-binary`, including whole-input and streaming paths. Contextual credential values also stop at NUL. Uniformly NUL-interleaved text remains detectable without joining ordinary NUL-delimited fields to a credential.
