---
'@link-foundation/sensitive-data-sanitizer': minor
---

Match a reused restore map PERSON entry like an explicit `knownPersonal` value, so a bare or lower-case part no longer merges people or fails with `ERR_RESIDUAL`, keep parts listed as their own values in an optional `standalone` entry field, cover the adjacent given name or patronymic when a bare part matches, and read labelled CV experience lines (`Опыт: Менеджер, Ромашка (2018 – 2020)`), titles of up to nine words and the `по н.в.` open range in the `documents` profile.
