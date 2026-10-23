---
'@link-foundation/sensitive-data-sanitizer': minor
---

Support shared tool-log sanitization with credentials-only policy, automatic environment-value discovery and GitHub CLI config credentials. Preserve invalid log bytes losslessly, accept long text records within the total input limit, remove quadratic scanning and retain benign auth metadata, dependency names, local addresses and credential references. Raise the whole-text default to 32 MiB for image-bearing rollout lines.
