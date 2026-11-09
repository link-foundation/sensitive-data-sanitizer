# Issue 124 reproduction

Policy: `profile: 'documents', properNames: 'capitalized', strict: true`.

Run `node experiments/issue-124/reproduce.mjs`. Before the fix, `took 30 ms Retry
scheduled` redacted `Retry`, `see dr Drive mount` redacted `Drive`, and compound
keys such as `recruiterDisplayName` kept their values. After the fix, unit and
lowercase cases stay unchanged, capitalized honorifics (`Ms Smith`, `Dr. Smith`)
still redact the name, and compound person keys are replaced.

Regression tests: `tests/sanitizer-issue-124.test.js`.
