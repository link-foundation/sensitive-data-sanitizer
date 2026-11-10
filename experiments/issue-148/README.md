# Issue 148: repeated credential masking consumes prose

## Requirements and evidence

The issue and all issue/PR conversation comments, inline comments and reviews
were read before implementation. There were no comments or required sub-issues.
Issues 132 and 133 describe the earlier context and idempotency fixes; their
existing tests remain part of focused validation.

| Requirement                                                           | Implementation                                                                                                                  | Regression coverage                                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Preserve `User token: ghp…b4N. Next sentence` on repeated passes      | Bound open-ended credential spans at a complete existing mask, then recognize sentence punctuation as a valid template boundary | Original reproduction, three passes                                                                                      |
| Preserve original partial mask and surrounding punctuation/whitespace | Reuse `maskedValue`; trim only trailing sentence punctuation from the first token                                               | Unicode/ASCII ellipsis and asterisk masks, eight separators                                                              |
| Keep detecting another credential later on the same line              | Narrow each finding separately rather than exempting the original whole-line span                                               | Labeled and unlabeled later vendor credentials                                                                           |
| Repeat plaintext and encoded passes through the lightweight entry     | Apply the same span refinement and template policy in decoded views                                                             | Three passes for plaintext, base64, base64url, hex and percent; raw credentials and existing-mask-plus-credential inputs |
| Preserve other findings and exact known secrets                       | Leave known-secret spans untouched and keep their exemption prohibition                                                         | Known masked-shaped secrets at the context start and later on the line; literal material glued to masks                  |
| Retain optional diagnostic tracing                                    | Existing `debug` callback emits `template-value` after narrowing                                                                | Diagnostic event regression; tracing defaults off                                                                        |
| Prepare automatic release                                             | Patch changeset                                                                                                                 | `.changeset/issue-148-mask-context.md`                                                                                   |

## Root cause

The initial pass bounds the broad `context` finding using a vendor finding with
the same start. After masking, vendor rules no longer match `ghp…b4N`, leaving
only the context finding through the end of the line. That finding includes
prose, so the whole-value template check cannot recognize the existing mask.
The NFKC view also presents the ellipsis as three dots. Narrowing must precede
the template check in both original and decoded views. The template boundary
check must allow a period followed by whitespace while still rejecting literal
material glued to a mask, such as `ghp…b4N.literalSecret9`.

## Reproduction and focused validation

```sh
node --test --test-concurrency=1 --test-timeout=30000 \
  tests/sanitizer-issue-148.test.js \
  tests/sanitizer-issue-142-context.test.js \
  tests/sanitizer-issue-142-config.test.js \
  tests/sanitizer-issue-142-encoding.test.js
```

Before the source changes, the original reproduction produced
`User token: ghp…nce` on its second pass. The new regression suite failed on
plaintext and encoded prose preservation, later credentials, known-secret
context and the template diagnostic. After the fix, all 46 focused checks pass.
The percent fixture uses the existing encoder's complete, lowercase byte
escaping; no encoding behavior was changed. Full platform/runtime checks run
in the existing CI pipeline.
