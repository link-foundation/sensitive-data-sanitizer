# Unpadded wrapped base64 before prose

Issue: https://github.com/link-foundation/sensitive-data-sanitizer/issues/162

PR: https://github.com/link-foundation/sensitive-data-sanitizer/pull/163

## Reproduction and root cause

Run `node --max-old-space-size=256 experiments/issue-162/reproduce.mjs`.
The finite synthetic reproducer prints lengths and decoded-run offsets only.
The 40-character credential produces unpadded base64 JSON. At width 20, the
complete payload occupies `[31, 127)` in a 142-character input.

The wrapped regular expression greedily includes the first alphabet word on
the next prose line. Appending `trailing` makes this candidate fail canonical
base64 or fatal UTF-8 validation. Without a wrapped run covering the payload,
the ordinary base64 scanner decodes separate lines and the sanitizer masks
fragments, corrupting the complete JSON.

The padded 41-character specimen in PR #157 terminates at `=` and therefore
does not exercise this ambiguity. No required sub-issues or additional issue
or PR comments were present during investigation.

## Change and limits

For wrapped candidates within the existing 8 KiB ordinary text bound, reject
invalid trailing lines one at a time, selecting the longest canonical textual
prefix that still spans multiple lines. Resume matching after that prefix so
later independent payloads are scanned. The accepted run then uses the normal
complete-payload detection, sanitization, re-encoding and coverage paths.

This recovery preserves nonuniform wrapping accepted by the decoder and does
not require JSON-specific parsing. Large candidates still follow the bounded
binary inspection and encoded-limit paths. Ambiguous following text that itself
forms a valid textual encoding has no distinguishable delimiter; the longest
valid candidate remains the interpretation, as for other encoded text.

## Requirements and verification

| Requirement                                        | Evidence                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Complete unpadded JSON is sanitized and re-encoded | Exact decoded JSON and output assertions in the issue-162 tests in `tests/sanitizer-issue-142-encoding.test.js` |
| Preserve the note, surrounding prose and wrapping  | Exact expected wrapped output at widths 20, 40, 48, 64 and 76 with LF and CRLF                                  |
| One complete payload span                          | Decoder and finding offset assertions; width 20 retains `[31, 127)`                                             |
| ESM and CommonJS `/credentials` entries            | Import and package self-reference through `createRequire`, with sync and async engines                          |
| Whole-text and streaming agree                     | Every two-chunk split of each input, using small 32-byte batches                                                |
| Keep later payloads visible                        | Multiple alphabet-only prose lines and a second wrapped payload regression                                      |
| Preserve binary handling and bounds                | Existing issue-149 harmless/sensitive binary and nested-limit regressions                                       |
| Prepare a release                                  | Patch changeset `.changeset/issue-162-wrapped-prose.md`                                                         |

All ten width/newline regressions fail against the original decoder at their
complete-span assertion. With the fix, the initial focused Node run passed
115 tests across encoding, long-log and session-identity coverage. The added
adjacent-payload regression also passes. Full platform/runtime coverage runs
in the PR CI rather than duplicating those suites locally.
