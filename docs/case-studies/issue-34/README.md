# Issue 34: publishing session records

[Issue 34](https://github.com/link-foundation/sensitive-data-sanitizer/issues/34)
reported source files swallowed by label detection, raw propagation exceptions,
JSON key collisions, public CI paths redacted as identities, late confirmations,
and Unicode failures after the earlier identity fixes.

## Reproduction and root causes

Run the finite probes with bounded process memory and stack:

```sh
node --max-old-space-size=512 --stack-size=4096 experiments/issue-34/reproduce.mjs
node --max-old-space-size=512 experiments/issue-34/session-corpus.mjs
```

Before the change, a 30,440-character JSON source record became 60 characters and
a 13,471-character prompt record became 56. `root_turn_id` was rewritten and the
complete CI record supplied in the issue failed with `ERR_RESIDUAL`. These probes
reproduced the incorrect spans without needing an unbounded stack stress test.
The reported raw stack exception depends on the runtime's regex compiler; an
oversized seed regression separately verifies that such values never reach it.

Label detection treated escaped JSON line breaks as ordinary characters and
accepted code expressions as phone values. The same large spans then became
propagation patterns. Separators were also replaced after regex escaping, which
could corrupt the pattern. Document-name detection lacked a filename requirement,
and personal home-directory detection seeded CI service accounts. The credential
parser could split `passes` into the short label `pass` and Spanish verb `es`.

Label boundaries now handle raw and escaped line breaks and quotes, with a
512-unit bound and phone/email shape checks. Inferred seeds over 256 UTF-16 units
are excluded from propagation, and pattern separators are joined after escaping.
Unexpected internal exceptions return safe typed failures. Ordinary identifier
keys are protected during mapping and after propagation, while explicitly known
private keys and credentials remain protected. Document names require a path or
extension and plausible name words. CI service-account paths stay intact.

An encoded-sensitive string must retain its encoding handler when it overlaps a
phone finding. Otherwise the phone replacement could discard the entire JSON
string, including unrelated emoji and valid lone surrogate escapes. The regression
verifies both Unicode round trips and successful personal-value redaction.

## Two-pass publication and diagnostics

One-pass streaming retains its existing late-confirmation protection. Atomic file
APIs and the CLI add an explicit two-pass option: discover identities while
snapshotting a one-shot input into a private file, then redact the snapshot with
the complete registry. Both passes enforce record, input-byte, and registry
bounds. Required detectors and final residual checks remain active. Failure
preserves an existing target and removes unfinished output and raw input spools.

Malformed UTF-8 still blocks publication. JSONL diagnostics identify the record,
absolute byte offset, and offset within the record. These positions cross the
bounded file worker and appear in CLI errors without input text.

## Regression corpus and limits

`tests/fixtures/issue-34-sessions.mjs` combines Codex and Claude Code record shapes,
the complete public Codex vendor prompt, Claude Code prompt excerpts, finite
synthetic prompt tails, a 937-line code
output, the complete public CI output from the issue, identifier metadata, early
unlabelled names followed by confirmation, emoji, and lone surrogate escapes.
These are reproducible public fixtures; the private session files reported in the
issue were not supplied. The corpus makes no claim to contain the complete
Claude Code system prompt or every private session that failed. The Codex prompt
snapshot includes its upstream license, NOTICE, and source attribution.

`experiments/issue-34/session-corpus.mjs` publishes every fixture with one and four
workers, checks preserved source/CI/Unicode and removed private values, and runs a
fresh residual inspection. The release workflow gates on zero failures and zero
residual findings. Focused tests cover seed bounds, propagated JSON keys,
one-shot inputs, temporary permissions, limits, cleanup, required detectors, and
CLI/worker error reporting. Existing issue 18–33 regression suites remain in the
full runtime test matrix.

The corpus reports elapsed time for each run, but is too small to establish a
large-session throughput guarantee. Two-pass mode adds a discovery scan and disk
snapshot; callers must budget space for raw input and sanitized output. npm
publication remains a separate owner-side prerequisite tracked in
[issue 28](https://github.com/link-foundation/sensitive-data-sanitizer/issues/28).
