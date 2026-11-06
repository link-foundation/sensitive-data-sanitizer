Downstream evidence with current releases: `@actions/artifact@6.3.1` still resolves `archiver@7.0.1 -> archiver-utils@5.0.2 -> glob@^10.0.0`, although npm now publishes `archiver@8.0.0` and `glob@14.0.3`. We retain a scoped `archiver-utils.glob: 14.0.3` override rather than changing the Artifact SDK's entire archive major underneath its supported API.

Minimal compatibility check:

```json
{"dependencies":{"archiver-utils":"5.0.2"},"overrides":{"archiver-utils":{"glob":"14.0.3"}}}
```

After `npm install`, `require('archiver-utils').file.expand({cwd: '.'}, ['package.json'])` returns `['package.json']`. The consumer uses the retained `glob.sync` API. Our real SDK ZIP encode/decode and hosted artifact round-trip checks also pass with this override, including pending-deprecation errors enabled: https://github.com/link-foundation/sensitive-data-sanitizer/pull/103.

Suggested fix: publish a current `archiver-utils` dependency range for modern glob, and migrate the SDK to the maintained archive API when ready. Until the parent releases that integration, the scoped override avoids the unsupported/deprecated glob branch without forcing the unrelated archive API major. This adds current version and reproduction data to the existing report rather than opening a duplicate.
