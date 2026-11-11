---
'@link-foundation/sensitive-data-sanitizer': patch
---

Preserve Authorization and Proxy-Authorization scheme words when overlapping credential heuristics match exactly the scheme before a separate payload. Continue masking payloads, bare credentials, and exact known secrets.
