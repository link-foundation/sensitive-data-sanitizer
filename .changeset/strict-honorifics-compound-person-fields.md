---
'@link-foundation/sensitive-data-sanitizer': patch
---

Read `Mr`, `Ms` and `Dr` as person cues only when capitalized, so lowercase `ms` (milliseconds) and `dr` before a capitalized log word stay. Treat compound JSON keys ending in a personal field, such as `recruiterDisplayName`, `authorFullName` and `resumePdfOriginalFileName`, as person fields.
