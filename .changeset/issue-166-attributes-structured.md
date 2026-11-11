---
'@link-foundation/sensitive-data-sanitizer': patch
---

Label the diagnosis and community acronyms `СПИД`, `СДВГ`, `ПТСР`, `PTSD` and `ЛГБТ`/`LGBTQ+` in any letter case and redact a hyphenated compound around a special-category term (`вич-инфекция`, `женщина-врач`) as one attribute. Public findings now report one personal finding per span and type (#164). Structured JSON sanitization inspects each distinct key and string value once per call, and pattern scans no longer clone their expressions, cutting a 32-field log record from about 73 ms to about 15–18 ms (#165).
