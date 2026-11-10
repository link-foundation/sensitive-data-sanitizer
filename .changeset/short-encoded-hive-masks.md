---
'@link-foundation/sensitive-data-sanitizer': patch
---

Preserve canonical short base64/base64url Hive masks and escaped JSON log structure through verified sanitization. Reinspect bounded escaped JSON views with the configured exemption policy and detectors, while retaining exact known-secret detection and fail-closed handling at inspection limits.
