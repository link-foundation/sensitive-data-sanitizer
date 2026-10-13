---
'@link-foundation/sensitive-data-sanitizer': patch
---

Keep credential label values inside their JSON string and logical line, treat
prose such as "token for ES." as text, redact credential values covering escaped
JSON runs as a whole, and redact values found again after redaction in bounded
fixed-point rounds before failing closed with ERR_RESIDUAL.
