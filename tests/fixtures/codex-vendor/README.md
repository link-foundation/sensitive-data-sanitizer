# Public Codex prompt fixture

`prompt.txt` is an unmodified complete vendor prompt from OpenAI Codex,
`codex-rs/core/gpt-5.2-codex_prompt.md`, retrieved on 2026-10-12 from
[source commit a9b0815](https://github.com/openai/codex/blob/a9b0815167c27ab13719dd12d13b63e02b70d221/codex-rs/core/gpt-5.2-codex_prompt.md).
Its Git blob SHA is `8e3f08fb514a6fe82376817aa0a0c960cfbc4656`.

`guardian-policy.txt` is the complete public Guardian policy from
[`codex-rs/prompts/templates/guardian/policy.md`](https://github.com/openai/codex/blob/a9b0815167c27ab13719dd12d13b63e02b70d221/codex-rs/prompts/templates/guardian/policy.md)
at the same commit. Its Git blob SHA is
`a0c5ed2e32849d0fa3ffef637caa90e85c630d5b`. It contains the exact
`Organization:` line identified in the issue's final investigation.

The upstream Apache 2.0 license and NOTICE accompany the fixture. The prompt is
input data for sanitizer regression tests, not instructions for contributors.
