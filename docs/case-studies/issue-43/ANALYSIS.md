# Shared tool-log sanitizer: requirements, alternatives and evidence

Scope: [parent #43](https://github.com/link-foundation/sensitive-data-sanitizer/issues/43),
[#40](https://github.com/link-foundation/sensitive-data-sanitizer/issues/40),
[#41](https://github.com/link-foundation/sensitive-data-sanitizer/issues/41) and
[#42](https://github.com/link-foundation/sensitive-data-sanitizer/issues/42), in
[PR #44](https://github.com/link-foundation/sensitive-data-sanitizer/pull/44).
The complete issue bodies, native sub-issue relationships and all issue/PR
conversation comments, inline comments and reviews were read on 2026-10-23.
Those comment/review collections were empty. There are no additional required
native sub-issues. Each requirement below includes the chosen implementation
plan and its verification; npm publication remains explicitly unfinished.

## Requirement inventory and solution choices

| Requirement                                                                                 | Possible solutions and chosen plan                                                                                                         | Implementation / verification                                                                                                                             |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #43: address all three issues together, preserve closing references even for existing fixes | One implementation and evidence matrix, with a separate positive closing reference per issue                                               | PR description closes #43, #40, #41, #42 separately; no issue is considered complete merely because tests pass                                            |
| #40: disk-baseline path must remain intact                                                  | Remove OpenAI matching entirely, or require a genuine token boundary; choose the boundary                                                  | `rules.js` excludes `sk-` inside a word; real `sk-` and `sk-proj-` fixtures still redact                                                                  |
| #40: Docker endpoint and private/loopback proxy addresses must remain                       | Disable all IP detection, or classify local addresses; choose narrow classification                                                        | RFC 1918, IPv4/IPv6 loopback, link-local and IPv6 local ranges; public-address detection and explicit private overrides retained                          |
| #40: `auth_mode="Chatgpt"`, OAuth and ApiKey describe modes                                 | Ignore all auth fields, or exempt finite metadata values; choose exact metadata keys/values                                                | `context.js`; auth-token values and arbitrary modes still undergo credential detection                                                                    |
| #40: literal `Authorization: token $(gh auth token)`                                        | Exempt shell commands broadly, or recognize this literal reference; choose the latter                                                      | Reference parser recognizes gh token lookup only, never executes it; actual token header and unrelated command substitution tests remain sensitive        |
| #40/#42: npm package names and versions                                                     | Ignore any key containing auth/secret, or recognize package/version metadata; choose package-name plus version syntax                      | Scoped/unscoped dependencies including secretlint and next-auth; exact password/secret/token labels and known secrets retain priority                     |
| #40: Actions `id-token: write` and `${{ secrets.NPM_TOKEN }}`                               | Ignore any token field, or recognize permission enums and literal expressions; choose narrow recognition                                   | Exact permission values plus reference namespaces; actual credential values still redact                                                                  |
| #40/#42: token counts already work                                                          | Rewrite count detection, or preserve existing behavior with regression coverage; choose regression coverage                                | Existing numeric count exemption plus public tool-log and benchmark controls                                                                              |
| #40: ordinary default APIs must preserve the supplied lines                                 | Put all exemptions behind credentials-only, or fix default native and required union; choose default fixes                                 | Each supplied line tested in sync `sanitize`, async default `createSanitizer`, and escaped structured JSONL                                               |
| #41: repeated A runs must scan linearly                                                     | Replace all detectors, or profile and remove ambiguous starts; choose targeted fixes                                                       | Firebase and Mailchimp token boundaries, matching email start alphabet, targeted RE2 views and geometric stream-boundary scans                            |
| #41: random and zero-run base64; 15.7 MB rollout lines finish in seconds                    | Skip image strings (would lose embedded credentials), or optimize rules with a compatible large-input engine; choose preserved detection   | Finite seeded benchmarks, RE2JS above the WASM safe view size, 32 MiB whole-input default; unbounded credential rules retain complete values              |
| #41/#42: invalid UTF-8 must survive with valid surrounding secrets sanitized                | Latin-1 whole-input mapping, lossy replacement, or surrogate escape; choose surrogate escape to retain Unicode detection                   | Byte decoder/encoder, CLI whole/stdin/output/in-place, streams, workers and two passes; every split and every byte round trip tested                      |
| #42: one library for three consumers                                                        | Modify three independent repos here, or expose a shared integration and keep their tracked migrations separate; choose library integration | `examples/shared-tool-logs.mjs`, public exports/types, packed-package smoke test; migrations remain tracked in their own repositories                     |
| #42: actually publish npm package                                                           | Trusted publisher configuration or bootstrap publish token; both supported by existing release workflow                                    | **BLOCKED externally:** E404, no release, OIDC exchange 404, no repository secret or local npm credential. A dry run does not satisfy this requirement    |
| #42: discover all credential-named environment values                                       | Maintain only a curated list, or use start-command's name regex; choose regex with explicit-selection compatibility                        | `knownSecretsFromEnv(env)` discovers arbitrary names and listed AI-tool variables; explicit array and `[]` retain selection behavior; CLI `--env-secrets` |
| #42: keep curated AI-provider coverage                                                      | Add a second duplicate list, or prove the regex covers it; choose regression coverage                                                      | All 17 upstream credential entries tested individually; non-credential TELEGRAM_OWNER_CHAT_ID remains public metadata                                     |
| #42: local `~/.config/gh/hosts.yml` as well as gh subprocess                                | Handwritten line regex or YAML parser; choose existing maintained `yaml` component                                                         | Every host/account oauth_token/api_token, quoting/comments/dedup; gh path precedence, missing file, malformed YAML and alias tests; opt-in CLI/API        |
| #42: lines longer than 64 KiB/1 MiB cannot expose a credential tail                         | Fixed overlap would truncate unbounded tokens; retain complete logical records with geometric rescans                                      | Plain text inherits total byte limit, explicit record limit remains available; >1 MiB header spans many 64 KiB chunks and redacts in full                 |
| #42: maintain safe publication and resource limits                                          | Unlimited RAM or explicit total/record/worker limits; choose configurable finite budgets                                                   | Atomic output, no publication after limit/binary failure; memory proportional to held record, documented for deployments                                  |
| #42: preserve public EMAIL/account identifiers without one reviewed entry per value         | Per-type allow list or credentials-only option (issue permits either); choose credentials-only                                             | Central finding policy covers native/known/supplied/decoded/external/structured findings, streams/workers/two passes and CLI; credentials still detected  |
| Release preparation                                                                         | Manual version bump or repository Changesets workflow; choose one minor Changeset                                                          | `.changeset/tool-log-unification.md`; keep version history forward-moving                                                                                 |
| Regression prevention across codebase                                                       | Patch just CLI examples, or shared rules/policy/byte handling; choose shared implementation                                                | Full Node/Bun/Deno suites, CLI/API/structured/file/stream/worker tests and differential vendored-rule matches                                             |

## Research and existing components

[start-command's sanitizer](https://github.com/link-foundation/start/blob/main/js/src/lib/log-sanitizer.js)
uses a credential-name regex, reversible Latin-1 bytes and block continuation.
[hive-mind's sanitizer](https://github.com/link-assistant/hive-mind/blob/main/src/token-sanitization.lib.mjs)
adds curated local values, gh credential configuration and hold-back behavior.
Their useful behaviors inform the API rather than adding three divergent copies.
The consumer migrations are
[gh-upload-log#55](https://github.com/link-foundation/gh-upload-log/issues/55),
[start#250](https://github.com/link-foundation/start/issues/250) and
[hive-mind#3740](https://github.com/link-assistant/hive-mind/issues/3740).
These are migration context, not new native child issues of this PR.

[RE2/WASM](https://github.com/google/re2-wasm) remains the normal bundled Gitleaks
engine. Profiling showed that its JS wrapper copies the input for each search,
and its fixed 16 MiB WASM heap cannot hold rollout-sized inputs. Required-context
preselectors and complete token views reduce copying without dropping the
catalog. Five contextual rules and the bounded Authress prefix rule get local
views; rules with unbounded
credential bodies keep full matches. Inputs above 4 MiB of UTF-8 use
[RE2JS](https://github.com/le0pard/re2js), a maintained JavaScript RE2 port with
linear matching and compatible inline flags/capture groups. A DFA existence
check avoids capture construction when no match exists. This retains the
original expressions without a fixed WASM heap or chunked-token truncation.
Evaluated RE2/WASM forks still had fixed heaps. Differential fixtures compare
captured secrets to the vendored expressions, including Unicode offsets and long
values. Optional per-rule tracing contains only rule IDs, input lengths and
timings and is disabled by default. Capturing a multi-megabyte positive match
still costs proportionally more than a negative scan; callers retain record,
total-byte and worker limits.

The maintained [yaml parser](https://github.com/eemeli/yaml) was already present
as a development dependency; it is now a direct runtime dependency. Its
[documented parser options](https://github.com/eemeli/yaml/blob/main/docs/03_options.md)
allow alias expansion to be disabled (`maxAliasCount: 0`). This handles quoted
YAML safely and correctly instead of relying on a token-line regex. Parser
logging is silent and pretty error snippets are disabled: unresolved-tag
warnings otherwise include the source credential line. A regression intercepts
both Node warnings and console warnings and verifies that no diagnostic is sent.

[Pino fast-redact](https://github.com/pinojs/fast-redact) and
[Pino redact](https://github.com/pinojs/redact) are useful when callers know
structured object paths. They cannot replace arbitrary free-text log detection,
encoded payload handling or this project's required scanner union. Secretlint,
Gitleaks, libphonenumber and existing personal-data rules are retained.
No network service is required for sanitization or local credential discovery.

## Root causes and reproductions

Before changes, 25,000 repeated A characters spent about 2.9 seconds in the
Firebase regex alone and 6.2 seconds in synchronous sanitization on this
container. An unbounded `AAAA...` alternative restarted at every character.
The 100 KB native case in the issue was already quadratic; an explicit token
start turns each long failed run into one attempt. A similar email start-alphabet
mismatch retried at each slash inside base64. RE2 profiling then isolated generic
context rules repeatedly scanning/copying image strings for incidental keywords.
Plain unlabelled records also spent substantial time in the large vendor-label
alternation. A required-separator precheck skips that alternation while retaining
all automatic format recognizers. Bun's existing 12 MB file-worker regression
went from a 30-second timeout to 18.9 seconds after this fix. Large inputs avoid
WASM for every local view, preventing exhaustion after earlier catalog scans in
Bun's shared test process.

The 15.7 MB probe also exposed V8 stack overflow for unbounded `{N,}` service
and raw-base64 quantifiers. Equivalent `{N}` followed by `*` avoids that stack
growth. A separate WASM out-of-memory failure motivated the large-view RE2JS
fallback rather than suppressing detection on large records.

The first public-log regression run failed 12 cases, preserving real credential
positive controls. The initial byte-publication regression failed with
`ERR_ENCODING`; the initial >1 MiB stream-header regression failed `ERR_LIMIT`.
Those tests were added before their corresponding fixes. Existing UTF-8 failure
tests now use structured JSONL (which remains strict) or binary NUL input;
existing private-IP tests explicitly select `publicKnowledge: false` where
private detection is intended. The review corpus retains a global-IP positive
and now treats a local IP as an explicit negative control.

Reproduce finite performance probes from the repository root:

```bash
# Finite input bounds in each script, finite heap and CPU budget.
(ulimit -t 120; node --max-old-space-size=256 experiments/issue-43/profile.mjs 100000)
(ulimit -t 120; node --max-old-space-size=256 experiments/issue-43/benchmark.mjs 15700000)
(ulimit -t 60; node --max-old-space-size=256 experiments/issue-43/components.mjs 1000000)
```

`benchmark.mjs` uses a fixed seed, repeated A data and zero-filled image data.
CPU profiles can be created with Node's `--cpu-prof --cpu-prof-dir=/tmp` and
summarized with `experiments/issue-43/hotspots.py`. The old and new timing evidence
and final validation results are recorded in `VALIDATION.md`.

## npm publication blocker and concrete completion steps

On 2026-10-23, `npm view @link-foundation/sensitive-data-sanitizer version`
returned E404 and `gh release list` was empty. Latest main release run
[38456752244](https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/38456752244)
(commit 02104ac, 2026-10-13 19:40 UTC) reports OIDC package-exchange 404 and no
NPM_TOKEN fallback (preserved log lines 153–160). Repository Actions secrets
were empty; local NPM_TOKEN/NODE_AUTH_TOKEN and npmrc publishing credentials
were absent. No token values were printed during these checks.

[npm's trusted-publisher documentation](https://docs.npmjs.com/trusted-publishers/)
requires npm 11.5.1+ / Node 22.14+ and an authorized workflow/repository mapping.
The release workflow already uses hosted runners, OIDC permissions and a token
bootstrap fallback. Its preflight is advisory on PRs and fails explicitly on
main when publication credentials require maintainer action; disabling that
failure would hide the unmet publication requirement.

A package owner must provide a scoped bootstrap publishing credential through
NPM_TOKEN, or establish a valid npm trusted publisher for
link-foundation/sensitive-data-sanitizer / release.yml. New trusted publishers
must authorize direct publish and complete their first publish before expiry.
Then run the existing release workflow, verify registry installation and API/CLI
smoke tests, and confirm a GitHub release. Neither packing locally, passing CI,
nor documenting this blocker constitutes publication. Keep PR 44 unmerged while
that required outcome remains blocked.
