# Research file formats

Files ending in `.json` contain a single JSON value. Files ending in `.jsonl`
preserve newline-delimited CLI output (one JSON value per query result, page,
or selected comment/job). These were renamed from `.json` during final review
to describe their actual format; their contents were not changed.

Renamed snapshots:

- `upstream-actionlint-657-comments.json` → `upstream-actionlint-657-comments.jsonl`
- `upstream-artifact-2003-comments.json` → `upstream-artifact-2003-comments.jsonl`
- `upstream-buildx-search-all.json` → `upstream-buildx-search-all.jsonl`
- `upstream-npm-9787-comments.json` → `upstream-npm-9787-comments.jsonl`
- `upstream-pyyaml-951-comments.json` → `upstream-pyyaml-951-comments.jsonl`
- `upstream-pyyaml-981-comments.json` → `upstream-pyyaml-981-comments.jsonl`
- `upstream-setup-node-1553-comments.json` → `upstream-setup-node-1553-comments.jsonl`
- `workflows-a5480b1-jobs.json` → `workflows-a5480b1-jobs.jsonl`

Empty unsuccessful search captures were removed: `upstream-capacitor-gradle9.json`, `upstream-presidio-constraints-search.json`, `upstream-presidio-preshed-search.json`. An empty response is not evidence that upstream has no relevant issue. The Presidio searches were repeated against `data-privacy-stack/presidio` after discovering its repository move; full issue 2431 and comments are preserved. Java/Gradle compatibility conclusions use the linked official Gradle and Capacitor documentation.
