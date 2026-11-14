---
'@link-foundation/sensitive-data-sanitizer': minor
---

Add `identifiers` and `transliterate` flags for known values, settable per entry or as `compileKnown` defaults, to find listed names inside code identifiers and in common Latin spellings of Cyrillic words. Match name parts split by one line break with an optional comment or quote prefix. Report a listed part nested in a listed full name once, require the surname or its own entry for a given name with a patronymic, and match a given name with the surname initial. Compile and run only the known-value expressions whose literal anchors occur in the text, and add `compileKnown(..., { warm: true })`, so the first call with 2,500 entries takes about 1 ms instead of 8 s.
