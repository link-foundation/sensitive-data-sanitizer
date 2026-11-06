Confirmed with the current actionlint 1.7.12 and zizmor 1.32.0 that the local-action spelling conflict remains. Minimal workflow (with an `action.yml` at `.github/actions/setup-node`):
```yaml
name: self action
on: workflow_dispatch
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7.0.1
      - uses: $/.github/actions/setup-node
```
`actionlint -shellcheck= -pyflakes= repro.yml` reports `"$/.github/actions/setup-node" is invalid value for "uses" ... ref is missing` at the local action. zizmor's self-repository guidance prefers the `$/' spelling, while `./.github/actions/setup-node` is accepted by actionlint and requires a narrow self-repository exception in zizmor.

We retain that narrow exception and the conventional `./` syntax; neither analyzer is disabled: https://github.com/link-foundation/sensitive-data-sanitizer/pull/103 . Accepting `$/' local-action references, as proposed in #732, would let downstream repositories remove this exception. The fixture and exact latest-version output are preserved in that PR's issue evidence.
