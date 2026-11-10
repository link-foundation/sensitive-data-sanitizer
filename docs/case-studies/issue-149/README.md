# Issue 149: bounded wrapped base64

## Requirements and verification plan

- Preserve the issue's 150,000-byte noncredential binary payload, keeping work bounded.
  Verify byte-for-byte output for LF and CRLF through credentials sync/async engines,
  the stream API in 77-character chunks, and the equivalent flat JSON image.
- Sanitize the complete encoded JSON after `response body=`, preserve `note`,
  original wrapping and surrounding prose. Compare whole-text and streamed output
  with the same payload without the prefix, including exact finding offsets.
- Keep oversized uninspected text fail-closed, including credentials beyond the
  prefix probe. Preserve plaintext and exact-known-secret detection.
- Add a patch changeset, review the final diff, and verify current-head CI on PR #157.

Issue #149 had no comments or required sub-issues at initial investigation. PR #157
had no conversation comments, inline comments or reviews. Related PR #143 and
upstream consumer PR link-assistant/hive-mind#3741 were read for context.

## Root cause and implementation

`isLimitedTextRun` deliberately treated uniformly wrapped binary as an oversized
encoded candidate. Consequently, binary above 8,192 encoded characters received
`ENCODED_LIMIT`, while flat binary was left alone. The issue's finite input
was reduced from 202,632 characters to an 8-character hive mask.

Uniform standard-base64 binary runs up to 256 KiB of encoded input now receive
complete canonical decoding. A detection view separates invalid UTF-8 and binary
controls with spaces, then passes through the existing detector union. This checks
embedded text too; invalid UTF-8 is not a blanket exemption. If there are no
findings, the original bytes remain unchanged. Sensitive binary is masked as a
whole: its detection view cannot reconstruct the original bytes. Larger binary,
ordinary text above 8,192 characters and dense candidate windows retain their
fail-closed fallback. Nested decoding limits propagate to the entire outer run.
No plaintext or known-secret finding is exempted.

The issue's exact `body=` reproducer already passed on the prepared branch
(0.21.1 source). Its wrapped candidate starts at the first payload line and
ends after its final padding; `body` is below the matcher's 16-character minimum.
Regression coverage now pins both newline styles, finding offsets, complete JSON
content, wrapping, surrounding prose and whole-text/stream equality. No additional
matcher change was needed for this requirement.

## Reproduction and validation

Run `node --max-old-space-size=256 experiments/issue-149/reproduce.mjs`.
It prints decoded candidate metadata and output for the synthetic JSON and the
input/output sizes for the binary payload. After the fix the sizes are both
202,632. All values are synthetic.

The automated regression is `tests/sanitizer-issue-149.test.js`. Against the
original `src/encoded.js`, both binary preservation tests fail with an unexpected
`ENCODED_LIMIT` finding; the exact prose/JSON cases already pass. The fixed suite
also tests embedded credentials following invalid UTF-8, oversized nested encoded
text, and binary above the classification cap.

Two historical tests that required all wrapped binary to be masked were updated:
issue-142 now requires harmless bounded binary to survive, and session-identity
uses oversized textual content to retain its complete-run fallback assertion.

Focused checks use sequential Node test files with a 384 MiB heap and 30-second
per-test timeout. Full runtime/platform suites, static checks and security checks
are provided by the repository CI on PR #157.
