# Issue 128: open-source secret and credential scanners

Research date: 2026-11-10. Release, licence and activity data came from
`gh api repos/<owner>/<repo>` and `.../releases/latest` (or `.../tags` when a
repository has no releases) on that date. Rule counts were measured from the
source trees named in each section. A claim is marked **unverified** when it
comes only from a README or marketing page, or when it rests on a keyword or
code search that could miss an implementation.

The companion file
[`open-source-secrets-cases.json`](open-source-secrets-cases.json) has 298
cases (145 positive, 153 negative). They come from the upstream test suites
and fixtures linked below. Each case has this shape:

```json
{
  "tool": "...",
  "source": "<url>",
  "input": "...",
  "sensitive": ["exact substrings of input"],
  "template": { "optional": "object" },
  "negative": false,
  "notes": "..."
}
```

Safety convention, required because this repository runs Secretlint and GitHub push
protection:

- **Provider-prefixed tokens** (GitHub, GitLab, npm, Stripe, Slack, SendGrid, Google,
  Azure, AWS, Twilio, Terraform, age, JWT) are never written literally. Their
  `input` contains the placeholder `{{TOKEN}}` and their `template` gives the
  prefix, character set, length and checksum.
- **URL-userinfo passwords** (database, Redis, LDAP and HTTP URLs) also use
  `{{TOKEN}}`. Their `template.fill` holds the generic value to substitute before
  use, for example `hunter2`. Without this split, Secretlint's `basicauth` and
  `database-connection-string` rules would flag the file.
- **Generic passwords** such as `hunter2` or whispers' `hardcoded1` are written
  literally.

## 1. Summary

| Tool                                                                            | Licence                                                               | Language   | Latest release (date)                        | Rules / detectors                                                                    | Status                                                               |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------- | -------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| [Gitleaks](https://github.com/gitleaks/gitleaks)                                | MIT                                                                   | Go         | v8.30.1 (2026-03-21)                         | 222 on master (`config/gitleaks.toml`)                                               | Feature-complete, security patches only; author moved to Betterleaks |
| [Betterleaks](https://github.com/betterleaks/betterleaks)                       | MIT                                                                   | Go         | v1.10.0 (2026-11-04); v2.0.0-rc.7 prerelease | 474 on `main` (238 with `validate`), 466 in v1.10.0                                  | Active; launched 2026-03-15 by Zach Rice, sponsored by Aikido        |
| [TruffleHog](https://github.com/trufflesecurity/trufflehog)                     | AGPL-3.0                                                              | Go         | v3.99.8 (2026-11-02)                         | 893 directories under `pkg/detectors`; README says "800+", "700+" verifiable         | Active                                                               |
| [Kingfisher](https://github.com/mongodb/kingfisher)                             | Apache-2.0                                                            | Rust       | v2.18.1 (2026-11-09)                         | README: 503 bundled rules, 502 enabled at default `medium` confidence                | Active (MongoDB)                                                     |
| [Titus](https://github.com/praetorian-inc/titus)                                | Apache-2.0                                                            | Go         | v1.3.0 (2026-11-02)                          | README: 487 rules (from Nosey Parker and Kingfisher)                                 | Active (Praetorian)                                                  |
| [Nosey Parker](https://github.com/praetorian-inc/noseyparker)                   | Apache-2.0                                                            | Rust       | v0.24.0 (2025-05-08)                         | 188                                                                                  | **Archived**, superseded by Titus                                    |
| [detect-secrets (Yelp)](https://github.com/Yelp/detect-secrets)                 | Apache-2.0                                                            | Python     | v1.5.0 (2024-05-06)                          | 26 plugins + filters                                                                 | Maintenance; last code commit 2025-01-06                             |
| [detect-secrets (IBM fork)](https://github.com/IBM/detect-secrets)              | Apache-2.0                                                            | Python     | 0.13.1+ibm.64.dss (2025-10-02)               | Yelp plugins + box, db2, github_enterprise                                           | Active fork                                                          |
| [Secretlint](https://github.com/secretlint/secretlint)                          | MIT                                                                   | TypeScript | v13.1.0 (2026-10-26)                         | 27 rules in the recommend preset + optional rules                                    | Active; already a dependency here (13.1.0)                           |
| [ripsecrets](https://github.com/sirwart/ripsecrets)                             | MIT                                                                   | Rust       | v0.1.11 (2025-05-27)                         | Small pattern set + randomness test                                                  | Low activity                                                         |
| [Trivy](https://github.com/aquasecurity/trivy) (secret scanner)                 | Apache-2.0                                                            | Go         | v0.76.2 (2026-11-05)                         | 106 built-in rules (`pkg/fanal/secret/builtin-rules.go`)                             | Active                                                               |
| [Talisman](https://github.com/thoughtworks/talisman)                            | MIT                                                                   | Go         | v1.37.0 (2025-05-02)                         | Detector categories, not provider rules                                              | Low activity                                                         |
| [git-secrets](https://github.com/awslabs/git-secrets)                           | Apache-2.0                                                            | Shell      | tag 1.3.0, no releases                       | AWS patterns + user patterns                                                         | Dormant                                                              |
| [ggshield](https://github.com/GitGuardian/ggshield)                             | MIT (client)                                                          | Python     | v1.56.1 (2026-10-26)                         | "500+" (server side, **unverified**)                                                 | Active; needs a GitGuardian API key                                  |
| [whispers](https://github.com/Skyscanner/whispers)                              | Apache-2.0                                                            | Python     | 1.5.3 (2021-08-25)                           | Rule YAML + structured parsers                                                       | **Archived**                                                         |
| [secrets-patterns-db](https://github.com/mazen160/secrets-patterns-db)          | CC-BY-SA-4.0                                                          | YAML       | no releases; last push 2025-08-06            | 1610 patterns in `rules-stable.yml` (883 high, 727 low confidence); 144 PII patterns | Dataset only                                                         |
| [Semgrep Secrets](https://docs.semgrep.dev/semgrep-secrets/conceptual-overview) | Proprietary (**unverified**; Semgrep CE engine is LGPL-2.1, v1.184.0) | —          | —                                            | No public count                                                                      | Commercial                                                           |

Main changes since the previous competitor list:

- **Gitleaks** is frozen. It now receives security patches only, and its author
  has moved development to **Betterleaks**.
- **Betterleaks** is the most active rule set to follow. It has about twice as
  many rules as Gitleaks and adds rule expressions, a token-efficiency filter,
  confidence levels and live validation.
- **Nosey Parker** is archived. **Titus** replaces it, and **Kingfisher**
  inherited much of its design.
- **Kingfisher** is the only scanner found that implements **offline checksum
  validation** (CRC32/base62, Luhn, IBAN, BIP-39) as a rule-level filter.
- **whispers** is archived. Its fixtures are still useful because they cover
  structured configuration formats.

## 2. Per-tool notes

### 2.1 Gitleaks 8.30.1

Sources: [README](https://github.com/gitleaks/gitleaks/blob/v8.30.1/README.md),
[rules](https://github.com/gitleaks/gitleaks/tree/v8.30.1/cmd/generate/config/rules),
[decoder](https://github.com/gitleaks/gitleaks/tree/v8.30.1/detect/codec).

**Decoders.** These are enabled with `--max-decode-depth`:

- percent encoding
- hex runs of at least 32 characters
- base64 runs of at least 16 characters
- `U+XXXX` / `\uXXXX` unicode escapes; this decoder is in the code but not
  documented in the README

Archives are scanned up to `--max-archive-depth`.

**Reports:** `json`, `csv`, `junit`, `sarif`, and a Go `template`.
`--redact[=percent]` masks all or part of each secret.

**Suppression options:**

- the inline `gitleaks:allow` comment
- `.gitleaksignore` files listing finding fingerprints
- `--baseline-path`
- per-rule `allowlists` (regexes, paths, stopwords, commits)

**Composite rules.** `[[rules.required]]` (8.28+) reports a finding only when
companion rules match within a set number of lines or columns.

**Test cases.** The `generic.go` and `curl.go` rule generators contain true- and
false-positive tables; 52 cases are copied into the JSON. Notable false
positives:

- `csrf-token=`, `credentialsId:`, `<UserSecretsId>`, and `SRCREV_*` git SHAs
- `public_key`, `*_id` keys
- `$(...)` command substitution and `${{ env.X }}` placeholders in curl commands

**Relevance.** The project vendors these rules, and its Gitleaks bridge
deliberately passes `--ignore-gitleaks-allow` (`src/external.js`), so inline
allow comments are not honoured. That is a sound policy for a redactor.

### 2.2 Betterleaks 1.10.0 / 2.0.0-rc

Sources: [README](https://github.com/betterleaks/betterleaks),
[docs/config.md](https://github.com/betterleaks/betterleaks/blob/main/docs/config.md),
[rules](https://github.com/betterleaks/betterleaks/tree/main/cmd/generate/config/rules),
[codec tests](https://github.com/betterleaks/betterleaks/tree/main/internal/codec).

**Rule expressions.** Rules can use Expr-language `prefilter` and `filter`
expressions (docs/config.md, roughly lines 412–520). Built-in helpers include:

- `entropy()`
- `tokenRatio()` and `failsTokenEfficiency()`: these tokenise the candidate with a
  BPE tokenizer (`cl100k_base`) and a wordlist. Human-readable strings tokenise
  efficiently, so they are dropped.
- `setConfidence(low|medium)`

**Self-reported recall.** The README claims 98.6% recall on CredData for the
token-efficiency filter, against 70.4% for entropy alone (**unverified**).

**Validation.** Rules can make HTTP validation calls (`validate`), and there are
analysis and revocation workflows.

**Matching and suppression:**

- Multi-part `components` combine, for example, a key ID with its secret.
- `.betterleaksignore` matches SHA-256 or `hmac-sha256:` fingerprints.

**Output:** JSONL with a `schema_version`. Decoded findings record `encodings`
and `decode_depth`.

**Sources:** Git, directories, GitHub, GitLab, Hugging Face, S3 and container
images. A Go SDK is also available.

**Generic-rule negative filters** (from `generic_password.go` and the
structured tests):

- ciphertext: SOPS `ENC[...]`, Ansible Vault, Spring `{cipher}`, Jasypt
  `ENC(...)`, OpenSSL `U2FsdGVkX1`, Vault transit `vault:v1:`
- password hashes: bcrypt, argon2, SCRAM
- algorithm names: `AES-256-GCM`, `RSA/ECB/...`, `PBES2-...`, `CHACHA20-POLY1305`
- placeholders: `your_password`, `<...>`, `${...}`
- code references: `process.env.X`, `undefined`, `null`
- Kubernetes `valueFrom.secretKeyRef`
- name/value JSON pairs: the keyword can sit in a sibling `name` field or in an
  ancestor key

**Checksums.** None found. The Azure rule comment says a checksum "could be
used", but none is implemented (**unverified absence**; code search only).

**Policy differences for a redactor:**

- `generic-credential-uri` ignores `example.com` hosts.
- `replace_me` counts as a placeholder in URIs but as a secret in structured
  key/value tests.

The JSON has 78 Betterleaks cases.

### 2.3 TruffleHog 3.99.8

Sources: [README](https://github.com/trufflesecurity/trufflehog/blob/v3.99.8/README.md),
[decoders](https://github.com/trufflesecurity/trufflehog/tree/v3.99.8/pkg/decoders),
[false positives](https://github.com/trufflesecurity/trufflehog/blob/v3.99.8/pkg/detectors/falsepositives.go).

**Detectors and verification.** There are 800+ provider detectors, and the
README says over 700 can verify a credential live. Each result is marked
`verified`, `unverified`, `unknown` or `filtered_unverified`.

**Decoders:** `base64`, `escaped_unicode`, `html`, `utf16` and `utf8`.

- **escaped_unicode** handles `U+XXXX`, `\uXXXX`, `\u{X}`, `\UXXXXXXXX`,
  `\x{X}`, CSS `\X `, `&#xX;` and `%uXXXX`.
- **html** does the following:
  - strips tags and joins text split across `<span>`, `<em>` and `<strong>`
  - converts `<br>` to a newline
  - decodes entities, including double-encoded `&amp;amp;`
  - keeps comments, `<script>` and `<style>` contents
  - extracts `href`, `src`, `value`, `content` and `data-*` attributes, plus
    ASP.NET `ConnectionString` and `Text`
  - strips zero-width and invisible characters (`U+200B`, `U+200C`, `U+00AD`,
    `U+2060`, `U+FEFF`)
- **utf16** decodes little- and big-endian text, with or without a BOM.

**False-positive filtering.** Results matching the default terms (`example`,
`xxxxxx`, `aaaaaa`, `abcde`, `00000`, `sample`, `*****`) are dropped. So are
results matching the word lists `badlist` (288 entries), `words` (283),
`programmingbooks` (2871) and `uuids` (37), and results that are not valid UTF-8.

**Other features:**

- the `trufflehog:ignore` inline comment
- archive extraction with depth, size and time limits
- JSON, SARIF and GitHub Actions output
- custom regex detectors that can call a verification webhook
- `--fail` sets exit code 183 when results are found

**Checksums.** No CRC32 checksum validation was found in detector code
(**unverified absence**).

The JSON has 27 TruffleHog cases. The escaped-unicode tests upstream use a
provider token, so the JSON encodes a generic payload in all 8 formats instead.

### 2.4 detect-secrets (Yelp 1.5.0; IBM fork)

Sources: [README](https://github.com/Yelp/detect-secrets/blob/master/README.md),
[filters.md](https://github.com/Yelp/detect-secrets/blob/master/docs/filters.md),
[heuristic tests](https://github.com/Yelp/detect-secrets/blob/master/tests/filters/heuristic_filter_test.py),
[keyword tests](https://github.com/Yelp/detect-secrets/blob/master/tests/plugins/keyword_test.py),
[IBM fork](https://github.com/IBM/detect-secrets).

**Plugins:** artifactory, aws, azure_storage_key, basic_auth, cloudant, discord,
github_token, gitlab_token, Base64/Hex high-entropy, ibm_cloud_iam,
ibm_cos_hmac, ip_public, jwt, keyword, mailchimp, npm, openai, private_key,
pypi_token, sendgrid, slack, softlayer, square_oauth, stripe, telegram_token
and twilio.

**Heuristic filters** drop a candidate when it is any of the following:

- a sequential string, such as an alphabet or `0123456789`
- a likely ID: the key ends in `id` or `ids`
- a templated value: `{x}`, `<x>` or `${x}`
- an indirect reference: a function call or `request.headers[...]`
- not alphanumeric
- a potential UUID
- `$`-prefixed
- found in a lock file, a Swagger file or a non-text file

An optional gibberish ML model (`pip install detect-secrets[gibberish]`) can
filter further.

**Keyword plugin.** Its behaviour depends on the file type:

- C-like languages, Java, Python, JavaScript, Swift and Terraform need quotes
  around the value.
- Go accepts `:=`.
- `.conf` files accept unquoted values.

It also matches comparison and assignment forms such as `==`, `=>`,
`std::string x("...")` and `@"..."`.

**Workflow:**

- `.secrets.baseline`
- `detect-secrets audit` for labelling findings as true or false
- `detect-secrets-hook --baseline` as a pre-commit hook
- `--only-verified`
- inline `# pragma: allowlist secret` and `pragma: allowlist nextline secret`

**IBM fork.** It adds the box, db2 and github_enterprise plugins.

**Relevance.** The project already has a detect-secrets baseline adapter. The
46 cases in the JSON test the keyword grammar and the heuristic filters.

### 2.5 Secretlint 13.1.0

Sources: [preset README](https://github.com/secretlint/secretlint/tree/master/packages/%40secretlint/secretlint-rule-preset-recommend),
[releases](https://github.com/secretlint/secretlint/releases).

**Recommend preset:** aws, gcp, privatekey, npm, basicauth, slack, sendgrid,
shopify, stripe, github, gitlab, grafana, openai, anthropic, groq, huggingface,
linear, notion, 1password, database-connection-string, hashicorp-vault, vercel,
databricks, docker, figma, cloudflare, tailscale and filter-comments.

**Rules outside the preset:**

- `azure`
- `no-dotenv`, `no-homedir`
- `no-k8s-kind-secret`
- `pattern`
- `secp256k1-privatekey`
- `preset-canary`
- `formatter-sarif`

**13.1.0 changes:** `createEngine` masks secrets by default, and the formatter
strips terminal control characters.

**Relevance.** The project already uses the recommend preset at 13.1.0. The
optional rules (`azure`, `no-k8s-kind-secret`, `secp256k1-privatekey`) are not
enabled in this repository's own `.secretlintrc.json`. Whether the sanitizer
engine enables them is **unverified**.

### 2.6 Kingfisher 2.18.1

Sources: [README](https://github.com/mongodb/kingfisher/blob/main/README.md),
[docs/RULES.md](https://github.com/mongodb/kingfisher/blob/main/docs/RULES.md),
[docs/USAGE.md](https://github.com/mongodb/kingfisher/blob/main/docs/USAGE.md),
[docs/ADVANCED.md](https://github.com/mongodb/kingfisher/blob/main/docs/ADVANCED.md).

**Rules.** The README lists 503 bundled rules. At the default `medium`
confidence, 502 are enabled; `generic-api-key` is low confidence and is
excluded. Generic password and username detectors are not bundled. Older web
claims of 942 rules are out of date.

- The catalogue is based on Betterleaks rules plus Google Veles detectors.
- Kingfisher reads both Betterleaks TOML and its own YAML rule format.
- Matching uses Vectorscan/Hyperscan.

**Rule options:**

- `pattern_requirements` with `ignore_if_contains`
- `min_entropy`
- `depends_on_rule` for multi-part credentials
- **checksum filters:** `crc32`, `crc32_dec`, `crc32_hex`, `crc32_le_b64`,
  `base62`, `base36`, `luhn_valid`, `iban_valid` and `bip39_valid`. A GitHub-style
  token is checked offline by CRC32 of the body, base62-encoded, compared with
  the last 6 characters. See the
  [GitHub token format blog post](https://github.blog/engineering/platform-security/behind-githubs-new-authentication-token-formats/).

**Input handling.** Kingfisher detects UTF-16 and UTF-32 input automatically and
decodes base64 by default (`--no-base64` turns this off). It can scan inside:

- tar and zip archives, Office documents, `.asar`, HWP and EGG files
- PDF text and SQLite databases
- Python bytecode and Docker images

**Sources:** Git, GitHub, GitLab, Azure Repos, Bitbucket, Gitea, Hugging Face,
Jira, Confluence, Slack, Teams, Postman, S3, GCS and Azure Blob.

**Validation and response:** live validation, an access-map / "blast radius"
report, and revocation.

**Suppression:**

- inline `kingfisher:ignore` on the same line, on the preceding line or at a
  closing delimiter
- `--ignore-comment` to honour other tools' directives, such as `gitleaks:allow`
  or `NOSONAR`
- a YAML baseline
- `--skip-regex` and `--skip-word`
- skipping known canary-token AWS accounts: a built-in Thinkst list, extended
  with `--skip-aws-account`

**Output:** `json`, `jsonl`, `bson`, `toon` (compact, designed for LLMs),
`sarif` and `html`. `--redact` masks secrets.

**Integration:**

- SDKs for Rust, Python and Node
- a viewer that also imports Gitleaks, TruffleHog and SARIF reports
- distinct exit codes, 200 and 205, for different kinds of findings (the
  meaning of each is in USAGE.md)

### 2.7 Titus 1.3.0 and Nosey Parker 0.24.0

Sources: [Titus README](https://github.com/praetorian-inc/titus/blob/main/README.md),
[Nosey Parker README](https://github.com/praetorian-inc/noseyparker/blob/main/README.md).

**Titus:**

- 487 rules, with Hyperscan/Vectorscan and a pure-Go fallback
- runs as a CLI, a Go library, a Burp Suite extension or a Chrome extension
- `--validate` labels each finding `confirmed`, `denied` or `unknown`
- scans container images, including files deleted in lower layers
- extracts text from Office, PDF, Jupyter, SQLite, eml and rtf files, and from
  zip, tar, 7z, apk, ipa, crx and xpi archives
- scores findings as `base_score` plus modifiers; rules can be marked
  `noisy: true` or `visible: false`
- outputs JSON and SARIF

**Nosey Parker** (archived) had 188 rules, deduplicated matches across blobs and
used Vectorscan.

### 2.8 ripsecrets 0.1.11

Sources: [README](https://github.com/sirwart/ripsecrets/blob/main/README.md),
[`p_random.rs`](https://github.com/sirwart/ripsecrets/blob/main/src/p_random.rs),
[tests](https://github.com/sirwart/ripsecrets/tree/main/test).

**Design:**

- runs locally and never verifies credentials
- built for pre-commit hooks, on top of ripgrep; claims to be 95x faster than
  TruffleHog (**unverified**)

**Randomness test.** A value assigned to a secret-like name is reported when a
probability test says it is random: `p_random` must stay below 1e-4, computed
from the number of distinct characters and bigram statistics. This rejects
`hello_world`, `PROJECT_NAME_ALIAS` and repeated `asdf` runs without an entropy
threshold.

**Suppression and extension:**

- a `.secretsignore` file with a `[secrets]` section
- the detect-secrets `pragma: allowlist secret` comment
- `--additional-pattern`

**Test cases.** The `test/one_per_line/*` fixtures give positives for each
provider, and `test/none` gives negatives. The JSON has 37 ripsecrets cases;
provider tokens are written as templates.

**Policy difference:** an x-masked npm token and an x-masked Twilio SID are still
reported.

### 2.9 Trivy 0.76.2 (secret scanner)

Sources: [secret scanning guide](https://github.com/aquasecurity/trivy/blob/main/docs/guide/scanner/secret.md),
[built-in rules](https://github.com/aquasecurity/trivy/blob/main/pkg/fanal/secret/builtin-rules.go),
[built-in allow rules](https://github.com/aquasecurity/trivy/blob/main/pkg/fanal/secret/builtin-allow-rules.go).

**Rules.** Secret scanning is on by default, with 106 built-in rules. Custom rules
can set a `keywords` prefilter, and allow rules can be global or per rule.
Options include `enable-builtin-rules`, `disable-rules` and
`disable-allow-rules`. It also scans `.pyc` files, and output masks secrets as
`*****`.

**Path-based allow rules.** By default, Trivy skips these paths:

- `.dist-info`, `tests` and `vendor` directories
- paths containing `example`
- Markdown files (`.md`)
- `/usr` system directories
- locale files

This is a deliberate trade-off that would cause false negatives in a redactor.
It is noted as a policy contrast, not a feature to copy.

### 2.10 Talisman 1.37.0, git-secrets, ggshield, whispers, secrets-patterns-db, Semgrep Secrets

**[Talisman](https://github.com/thoughtworks/talisman/blob/main/README.md)**

- runs as pre-commit and pre-push hooks
- detectors: base64/hex encoded values, file content, file size, entropy, credit
  card numbers and suspicious file names
- `.talismanrc` ignores a file by name plus its SHA-256 checksum, so the ignore
  stops applying when the file changes
- also supports `ignore_detectors`, `allowed_patterns` regexes, an HTML report
  and a severity threshold

**[git-secrets](https://github.com/awslabs/git-secrets/blob/master/README.rst)**

- `--register-aws` adds AWS patterns
- supports prohibited and allowed patterns, `--add-provider` and
  `--scan-history`
- installs git hooks

**[ggshield](https://github.com/GitGuardian/ggshield/blob/main/README.md)**

- needs `GITGUARDIAN_API_KEY`; detection runs on the GitGuardian SaaS, so it does
  not fit an offline redactor
- offers honeytokens
- scans Docker images and PyPI packages
- provides pre-commit, pre-push and pre-receive hooks

**[whispers](https://github.com/Skyscanner/whispers/blob/master/README.md)** (archived)

- parses structured files: YAML, JSON, XML, `.npmrc`, `.pypirc`, `.htpasswd`,
  `.properties`, `pip.conf`, ini/conf, Dockerfile, dockercfg, shell scripts and
  Python source (through the AST)
- recognises declarations in JavaScript, Java, Go and PHP
- handles special formats: AWS credentials files, JDBC URLs, Jenkins
  configuration and Spring beans
- assigns severities and lets configuration include or exclude by file, key or
  value

  Its [fixtures](https://github.com/Skyscanner/whispers/tree/master/tests/fixtures)
  supply 55 cases. They are especially useful for shell (`curl`/`wget`/`docker -e`
  password flags), `.htpasswd`, JDBC and placeholder negatives such as
  `password: password` and `%env(X)%`.

**[secrets-patterns-db](https://github.com/mazen160/secrets-patterns-db)**

- 1610 regexes, each tagged high or low confidence, plus PII patterns and lists
  of sensitive field names
- patterns are ReDoS-tested
- includes converters to Gitleaks and TruffleHog formats
- CC-BY-SA-4.0: the share-alike licence matters if patterns are vendored

**[Semgrep Secrets](https://docs.semgrep.dev/semgrep-secrets/conceptual-overview)**

- commercial
- the docs describe semantic analysis (dataflow and constant propagation), regex,
  entropy and a "proprietary validator", with validation run locally
- supports custom rules with validators
- no rule count is published, and the product licence is **unverified**

## 3. Feature comparison

Legend:

- **Y**: supported
- **P**: partial
- **–**: absent
- **?**: unverified

The "This project" column is based on the README, `docs/` and keyword searches
of `src/`.

| Feature                                                 | This project                                       | Gitleaks                  | Betterleaks            | TruffleHog          | Kingfisher               | Titus      | detect-secrets               | Secretlint          | ripsecrets   | Trivy          | Talisman     | whispers     |
| ------------------------------------------------------- | -------------------------------------------------- | ------------------------- | ---------------------- | ------------------- | ------------------------ | ---------- | ---------------------------- | ------------------- | ------------ | -------------- | ------------ | ------------ |
| Offline operation                                       | Y                                                  | Y                         | Y                      | Y                   | Y                        | Y          | Y                            | Y                   | Y            | Y              | Y            | Y            |
| Redact / rewrite output (not just report)               | **Y** (placeholders, fake values, restore map)     | P (`--redact` in reports) | P                      | –                   | P (`--redact`)           | –          | –                            | P (masked messages) | –            | P (masked)     | –            | –            |
| Provider rule count                                     | 221 Gitleaks + Secretlint preset (+ bridges)       | 222                       | 474                    | 800+                | 503                      | 487        | 26 plugins                   | 27                  | ~30          | 106            | n/a          | ~100 (**?**) |
| Generic keyword/assignment rules                        | Y (17 languages of labels)                         | Y                         | Y                      | P                   | P                        | P          | Y                            | P (basicauth)       | Y            | –              | –            | Y            |
| Entropy / randomness test                               | Y (`--paranoid`)                                   | Y                         | Y                      | P                   | Y                        | ?          | Y                            | –                   | Y (p_random) | –              | Y            | –            |
| BPE token-efficiency filter                             | –                                                  | –                         | **Y**                  | –                   | –                        | –          | – (gibberish model optional) | –                   | –            | –              | –            | –            |
| Confidence levels                                       | Y                                                  | –                         | Y                      | P (verified status) | Y                        | Y (scores) | –                            | –                   | –            | P (severity)   | P (severity) | Y (severity) |
| Base64 / base64url decoding                             | Y (including wrapped lines)                        | Y                         | Y                      | Y                   | Y                        | ?          | –                            | –                   | –            | –              | P (detects)  | –            |
| Hex decoding                                            | Y                                                  | Y                         | Y                      | –                   | –                        | –          | –                            | –                   | –            | –              | P            | –            |
| Percent decoding                                        | Y                                                  | Y                         | Y                      | –                   | –                        | –          | –                            | –                   | –            | –              | –            | –            |
| HTML numeric entities                                   | Y                                                  | –                         | –                      | Y                   | –                        | –          | –                            | –                   | –            | –              | –            | –            |
| `\uXXXX`                                                | Y (JSON content escapes)                           | Y                         | Y                      | Y                   | –                        | –          | –                            | –                   | –            | –              | –            | –            |
| `U+XXXX`, `\u{X}`, `\UXXXXXXXX`, `\x{X}`, CSS, `%uXXXX` | –                                                  | P (`U+`)                  | P (`U+`)               | **Y**               | –                        | –          | –                            | –                   | –            | –              | –            | –            |
| `\xNN` UTF-8 byte escapes                               | Y                                                  | –                         | –                      | –                   | –                        | –          | –                            | –                   | –            | –              | –            | –            |
| HTML tag stripping, span joining, zero-width removal    | –                                                  | –                         | –                      | **Y**               | –                        | –          | –                            | –                   | –            | –              | –            | –            |
| UTF-16 / UTF-32 input                                   | – (NUL input refused unless `--allow-binary`)      | –                         | ?                      | Y                   | Y                        | ?          | –                            | –                   | –            | –              | –            | –            |
| Archives / Office / PDF / containers                    | –                                                  | P (archives)              | P (containers)         | Y                   | Y                        | Y          | –                            | –                   | –            | Y (images)     | –            | –            |
| Structured parsers (YAML/JSON/XML/INI/env)              | Y                                                  | –                         | P (structured generic) | –                   | –                        | –          | P (by extension)             | –                   | –            | –              | –            | Y            |
| JSONL streaming with structural policy                  | **Y**                                              | –                         | –                      | –                   | –                        | –          | –                            | –                   | –            | –              | –            | –            |
| Ciphertext / hash / algorithm-name negatives            | P (**?**)                                          | –                         | **Y**                  | –                   | –                        | –          | –                            | –                   | –            | –              | –            | –            |
| Placeholder / template negatives                        | Y                                                  | Y (stopwords)             | Y                      | Y (wordlists)       | Y                        | ?          | Y                            | –                   | Y            | –              | –            | Y            |
| Canary-token account skipping                           | –                                                  | –                         | –                      | –                   | **Y**                    | –          | –                            | –                   | –            | –              | –            | –            |
| Offline checksum (CRC32 token, Luhn, IBAN)              | P (Luhn/IBAN/national IDs only)                    | –                         | –                      | –                   | **Y**                    | –          | –                            | –                   | –            | –              | P (Luhn)     | –            |
| Live verification / revocation                          | – (by design)                                      | –                         | Y                      | Y                   | Y                        | Y          | P                            | –                   | –            | –              | –            | –            |
| Multi-part / composite rules                            | P (credential context)                             | Y (`required`)            | Y (`components`)       | Y                   | Y (`depends_on_rule`)    | ?          | –                            | –                   | –            | –              | –            | –            |
| Inline suppression comment                              | – (Gitleaks bridge ignores `gitleaks:allow`)       | Y                         | Y                      | Y                   | Y (+ foreign directives) | ?          | Y                            | Y                   | Y            | –              | –            | –            |
| Ignore file / baseline                                  | P (detect-secrets baseline adapter)                | Y                         | Y                      | –                   | Y                        | ?          | Y                            | Y                   | Y            | Y              | Y            | Y            |
| Git history scan                                        | Y                                                  | Y                         | Y                      | Y                   | Y                        | Y          | –                            | –                   | –            | –              | Y            | –            |
| Git history rewrite                                     | **Y**                                              | –                         | –                      | –                   | –                        | –          | –                            | –                   | –            | –              | –            | –            |
| SARIF output                                            | –                                                  | Y                         | ?                      | Y                   | Y                        | Y          | –                            | Y (formatter)       | –            | Y              | –            | –            |
| JUnit / CSV output                                      | –                                                  | Y                         | ?                      | –                   | –                        | –          | –                            | –                   | –            | Y (template)   | –            | –            |
| Remote sources (GitHub, S3, Slack, ...)                 | –                                                  | –                         | Y                      | Y                   | Y                        | P          | –                            | –                   | –            | Y (registries) | –            | –            |
| Pre-commit hook packaging                               | ?                                                  | Y                         | Y                      | Y                   | Y                        | ?          | Y                            | Y                   | Y            | –              | Y            | –            |
| PII (names, national IDs, cards)                        | **Y**                                              | –                         | –                      | –                   | P (Luhn/IBAN filters)    | –          | –                            | –                   | –            | –              | P (cards)    | –            |
| Bridges to other scanners                               | Y (Gitleaks, TruffleHog, Presidio, detect-secrets) | –                         | –                      | –                   | Y (imports reports)      | –          | –                            | –                   | –            | –              | –            | –            |

## 4. Test-case source index

| Source                                                                                                                                              | Cases in JSON | What it exercises                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| [Gitleaks generic.go](https://github.com/gitleaks/gitleaks/blob/v8.30.1/cmd/generate/config/rules/generic.go)                                       | 24            | `generic-api-key` true and false positives                                                     |
| [Gitleaks curl.go](https://github.com/gitleaks/gitleaks/blob/v8.30.1/cmd/generate/config/rules/curl.go)                                             | 28            | `curl -u` / `--user` and `-H Authorization` true and false positives                           |
| Gitleaks / Betterleaks codec tests                                                                                                                  | 9             | base64, base64url, percent, hex, `U+XXXX`, SHA non-decoding                                    |
| [Betterleaks generic_password.go](https://github.com/betterleaks/betterleaks/blob/main/cmd/generate/config/rules/generic_password.go)               | 37            | passwords, usernames, login calls, ciphertext/hash/algorithm negatives                         |
| [Betterleaks generic_credential_uri.go](https://github.com/betterleaks/betterleaks/blob/main/cmd/generate/config/rules/generic_credential_uri.go)   | 17            | URI userinfo passwords and placeholders                                                        |
| [Betterleaks generic_structured_test.go](https://github.com/betterleaks/betterleaks/blob/main/cmd/generate/config/rules/generic_structured_test.go) | 17            | name/value JSON, ancestor keys, next-line values, `secretKeyRef`                               |
| [TruffleHog decoders](https://github.com/trufflesecurity/trufflehog/tree/v3.99.8/pkg/decoders)                                                      | 22            | 8 escaped-unicode formats, UTF-16LE, HTML (10), base64 (3)                                     |
| [TruffleHog falsepositives_test.go](https://github.com/trufflesecurity/trufflehog/blob/v3.99.8/pkg/detectors/falsepositives_test.go)                | 5             | UUID / wordlist false positives                                                                |
| [detect-secrets heuristic tests](https://github.com/Yelp/detect-secrets/blob/master/tests/filters/heuristic_filter_test.py)                         | 22            | sequential, ID, templated, indirect, non-alphanumeric, `$` and UUID filters                    |
| [detect-secrets keyword tests](https://github.com/Yelp/detect-secrets/blob/master/tests/plugins/keyword_test.py)                                    | 22            | keyword grammar across languages                                                               |
| [detect-secrets README](https://github.com/Yelp/detect-secrets#inline-allowlisting)                                                                 | 2             | inline pragma suppression                                                                      |
| [ripsecrets tests](https://github.com/sirwart/ripsecrets/tree/main/test)                                                                            | 37            | randomness positives, `none` negatives, provider templates                                     |
| [whispers fixtures](https://github.com/Skyscanner/whispers/tree/master/tests/fixtures)                                                              | 55            | `.htpasswd`, `.pypirc`, JDBC, `pip.conf`, shell CLI flags, beans.xml, properties, placeholders |
| [Kingfisher ADVANCED.md](https://github.com/mongodb/kingfisher/blob/main/docs/ADVANCED.md)                                                          | 1             | inline ignore                                                                                  |

**Policy differences.** Some cases record a deliberate disagreement between tools.
A redactor should decide on each one explicitly:

- **`example.com` hosts.** Betterleaks ignores URI credentials on `example.com`.
  A log redactor probably should not.
- **`.htpasswd` hashes.** whispers flags APR1 hashes, while Betterleaks treats
  hashes as non-secrets.
- **x-masked values.** ripsecrets reports x-masked npm and Twilio tokens.
- **Test and documentation paths.** Trivy skips `tests/`, example paths and
  Markdown files.
- **CSRF tokens.** Gitleaks excludes CSRF tokens, though session-bound tokens in
  logs may still deserve redaction.
- **UUID-shaped values.** detect-secrets drops UUID-shaped values, but some
  providers use UUID-shaped API keys, such as the
  `dafa7817-...` `api_token` positive in Gitleaks.

## 5. Unverified items

- **Semgrep Secrets:** licence, rule count and offline behaviour come only from
  marketing and documentation pages.
- **ggshield:** the "500+ detectors" figure is server side and cannot be counted.
- **Betterleaks:** the CredData recall figures (98.6% vs 70.4%) are self-reported.
- **ripsecrets:** the "95x faster than TruffleHog" claim is self-reported.
- **Missing checksum validation** in Gitleaks, Betterleaks and TruffleHog rests
  on code search only.
- **Rule and detector counts:**
  - Kingfisher (503) and Titus (487) come from their READMEs.
  - TruffleHog's count is a directory count, which over-counts helper packages.
  - The whispers rule count is approximate.
- **This project's column** is based on keyword searches of `src/` (`sarif`,
  `junit`, `pragma`, `archive`, `utf-16`, `zero-width`, `crc32`, `argon`,
  `ansible`). A feature implemented under another name would be missed. In
  particular, ciphertext and hash negatives may exist in the credential context
  code without those keywords.

## 6. Gaps and recommendations for this project

Listed roughly in order of value for an offline redactor:

1. **More decoders.** Add the TruffleHog escaped-unicode variants (`U+XXXX`,
   `\u{X}`, `\UXXXXXXXX`, `\x{X}`, CSS `\X `, `%uXXXX`). Add HTML handling: tag
   stripping with span joining, attribute extraction and removal of zero-width
   characters (`U+200B`, `U+200C`, `U+00AD`, `U+2060`, `U+FEFF`). The JSON
   includes inputs for each of these.
2. **Better generic-secret filters.** Add Betterleaks' negatives for ciphertext,
   hashes and algorithm names (SOPS, Ansible Vault, Jasypt, Spring `{cipher}`,
   OpenSSL `Salted__`, Vault transit, bcrypt, argon2, SCRAM). Consider BPE
   token-efficiency or detect-secrets-style sequential/ID heuristics to cut false
   positives without lowering recall. Each needs a redactor-specific policy
   decision.
3. **Offline checksum validation** for provider tokens that carry a CRC32
   (GitHub-style `ghp_`/`gho_`/`ghs_`/`ghu_`/`ghr_`, npm). Kingfisher shows the
   approach. It raises confidence for findings and lets the redactor report
   "structurally valid" without any network access.
4. **UTF-16 / UTF-32 text.** Windows logs and PowerShell transcripts are often
   UTF-16LE. These are currently refused as NUL-containing unless
   `--allow-binary` is set.
5. **Machine-readable reports.** Add SARIF (and possibly JUnit) output for the
   findings report, so CI systems and code-scanning UIs can consume it. Gitleaks,
   TruffleHog, Kingfisher, Titus, Trivy and Secretlint all offer SARIF.
6. **Inline suppression and an ignore file** for false positives in source scans,
   ideally opt-in and fingerprint-based so they cannot silently hide new secrets
   in logs. Options include `.gitleaksignore`-style fingerprints, Talisman's
   checksum-bound ignores and Kingfisher's foreign-directive support.
7. **Canary-token awareness.** Kingfisher skips Thinkst canary AWS accounts. A
   redactor should still redact them, but could label them in reports.
8. **Archives and containers** (zip/tar/Office/PDF/SQLite/images), as in
   Kingfisher, Titus and TruffleHog. This is lower priority for a log and session
   sanitizer.
9. **Composite rules and confidence from multiple signals:** keyword plus format
   plus checksum plus entropy, similar to Betterleaks `components`, Gitleaks
   `required` and Titus scoring.
10. **Do not copy:**
    - live verification and revocation (they need the network and send the
      secret to the provider)
    - Trivy's path-based allow rules
    - `example.com` exemptions
