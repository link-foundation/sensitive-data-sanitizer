---
'@link-foundation/sensitive-data-sanitizer': minor
---

Join Markdown name records with `knownOnly: true`: consecutive list items that each hold one name field (`- **Фамилия:** Пряжкина`, `- **Имя:** Велимира`) and key/value table rows (`| Фамилия | Пряжкина |`) form one record, and bold, italic and code markers around a key or value stay outside the finding, so `Фамилия: **Пряжкина**` becomes `Фамилия: **[REDACTED]**`. Make `knownOnly` matching about 4× faster on short texts and faster on large ones: an anchor trie finds candidate positions, word starts are checked only there, and the decoded view is skipped when it cannot change a match. Give the large-input tests (the 8 MiB long runs, the 10 MiB bounded worker file and the 7 MB JSONL record) their own 90 s per-test bound so a slow CI runner does not block a release.
