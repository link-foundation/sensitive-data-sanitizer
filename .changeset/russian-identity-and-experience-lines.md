---
'@link-foundation/sensitive-data-sanitizer': minor
---

Match known Russian names in all six cases and both word orders, with `ё`/`е` variants, initials and surname-plus-given forms. Give all case forms of one known person, organization, school or location one declined fake identity with natural names and an optional `pools` override. Keep `@handle/email` and `Name-99` organization spans whole so placeholders stay restorable and are never glued to digits. Detect employers in CV experience lines of the `documents` profile.
