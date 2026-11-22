---
'@link-foundation/sensitive-data-sanitizer': minor
---

Match regular noun-type family plurals for standalone Cyrillic surnames, such
as `Рабиновичей` and `Ковальчуками`. Standalone Cyrillic surnames now require
capitalization in prose. Set `properCase: false` on an entry or in `compileKnown`
to retain lowercase prose matches.

Preserve common capitalized Russian numerals and imperatives at sentence start,
and keep placeholder sequence numbers out of strict age findings.
