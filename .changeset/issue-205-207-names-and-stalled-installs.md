---
'@link-foundation/sensitive-data-sanitizer': patch
---

Find listed short Russian given names in every case with `knownOnly: true`: `Ян`, `Ким`, `Ева`, `Ия`, `Лев`, `Ной` and `Любовь` now match beside the listed surname or its initial (`Сурдину Яну`, `с Гусевым Кимом`, `Шмелёвой Еве`, `Пыжикову Льву`, `Рябинцевой Любви`, `Яну С.`), and fake mode replaces them as the same person. A surname with `ё` (`Шмелёва`, `Фомичёв`) and a short given name that ends like a surname (`Ева`, `Лев`) now get the right roles. An initial without a period must end its word, so `Марк Ф2`, `Марк Ф-2`, `Марк Фб` and `if I mark F2C` no longer match `Фомичёв Марк`, while `Марк Ф`, `Марк Ф,` and `Марк Ф.` still do. Keep a single hung install from blocking a release:

- Retry every `npm ci` once under its own budget (`BUDGET_ATTEMPTS` in `scripts/run-with-budget-warning.sh`), and give `Setup Bun` and both `Setup Deno` attempts a two-minute step timeout.
- Let `Rerun unacquired jobs` also rerun a cancelled, timed-out or failed run whose only bad jobs stalled in their setup before any test step ran, confirmed by a timeout annotation, so a run that someone cancelled stays cancelled.
