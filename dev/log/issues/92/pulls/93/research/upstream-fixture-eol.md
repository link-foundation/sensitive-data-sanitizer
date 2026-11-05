A shared test-fixture warning also appears in `tests/archive-and-discovery.test.js` at 7877a27980664bc6453e80262f8391d1c2562ab1. The test creates a temporary Git repository without fixing its line-ending policy. On Windows, the inherited `core.autocrlf=true` converts its LF fixtures and prints warnings for `dev/log/reference/sample.js` and `src/maintained.js`. Downstream run https://github.com/link-foundation/sensitive-data-sanitizer/actions/runs/42072807448 contains both warnings under each of Node, Bun and Deno (lines 17359–17360, 31298–31299 and 34473–34474).

Minimal reproduction in a fresh temporary directory:

```sh
git init -q
printf '// maintained\n' > sample.js
git -c core.autocrlf=true add sample.js
```

This prints `LF will be replaced by CRLF the next time Git touches it`. The fixture has no `.gitattributes`, so the production repository's policy cannot protect it.

Workaround/code suggestion: immediately after initializing that temporary repository, run `git config core.autocrlf false`. Keep the source file content and assertions unchanged; do not suppress Git warnings globally. The corresponding downstream fixture correction is in PR https://github.com/link-foundation/sensitive-data-sanitizer/pull/93, commit 2884895b7f2355aea15debd03d7a5ed8d208a101. Its following Windows Node/Bun/Deno runs contain no LF conversion warnings.
