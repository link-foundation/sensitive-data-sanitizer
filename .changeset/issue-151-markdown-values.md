---
'@link-foundation/sensitive-data-sanitizer': patch
---

Preserve complete credential placeholders and public configuration values before Markdown backticks, including the exact `HIVE_MIND_CLAUDE_AUTH_AUTHORITY=conventional` opt-out. Keep masking actual HTML/script and keyword-prefixed credentials, with exact known secrets taking priority.
