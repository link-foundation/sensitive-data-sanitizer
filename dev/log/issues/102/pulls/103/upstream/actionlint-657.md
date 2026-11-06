Latest-version verification: actionlint 1.7.12 still rejects the documented concurrency `queue` key on Linux. Minimal reproduction:
```yaml
name: queued
on: workflow_dispatch
permissions:
  contents: read
concurrency:
  group: queued-example
  queue: max
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - run: echo checked
```
`actionlint -shellcheck= -pyflakes= repro.yml` reports `unexpected key "queue" for "concurrency" section` (line 8). The downstream workaround is a narrowly scoped ignore for only this diagnostic, retaining queue behavior and all other workflow checks: https://github.com/link-foundation/sensitive-data-sanitizer/pull/103 .

This confirms the existing report on the current published release. Adding the documented queue enum/schema support (the work tracked by #654) would remove the exception; increasing job timeouts or deleting queue behavior would not address the parser mismatch.
