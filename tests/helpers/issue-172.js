// Shared inputs of the issue 172 tests. Separate files give each engine its
// own Node.js 22 file timeout and let CI distribute the scans across shards.
//
// Issue 172: with the `u` flag, V8 compiles a class that can match an astral
// code point (`[\p{L}\p{N}]`) as a non-simple loop on a two-byte string (one
// holding any character above U+00FF). Each character of a long letter run
// then took a backtracking entry, and a 4 MiB run next to an emoji, a `—` or
// a hive mask (`xx-…789`) overflowed the regular-expression stack, so
// `sanitize()` failed closed with ERR_SANITIZATION. One-byte strings passed.
// Before the fix 4 MiB failed in credentialPrefix and 6 MiB in the e-mail
// scans; 8 MiB keeps a margin. These tests check that a long run does not
// overflow, not how fast it is scanned: each has its own 90 s bound, since a
// slow macOS Intel runner can take over the 30 s bound of every other test.
export const large = 8 * 1024 * 1024;
export const secret = 'xx-private-value';
export const run = (unit, bytes) => unit.repeat(Math.ceil(bytes / unit.length));
export const options = { maxInputLength: 64 * 1024 * 1024 };
export const tails = {
  'emoji + token': '\n🔐 token refreshed\n',
  'hive mask': '\npassword=xx-…789\n',
  'dash + secret': `\n— password=${secret}\n`,
};
