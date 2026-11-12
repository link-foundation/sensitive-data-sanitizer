// Names every regular expression that overflows V8's regexp stack while the
// sanitizer scans a long run followed by a two-byte tail (issue 172).
// RegExp.prototype.exec is wrapped, and matchAll/replace/test go through it,
// so the first RangeError reports the expression source and flags. With
// KEEP_GOING=1 a failing exec returns null and the scan lists all of them.
// Usage: node find-regex.mjs [unit JSON] [KiB] [credentials|default] [head JSON]
import { createSyncSanitizer } from '../../src/credentials-entry.js';
import { createSanitizer } from '../../src/index.js';
const unit = JSON.parse(process.argv[2] ?? '"A"');
const kib = Number(process.argv[3] ?? 6144);
const mode = process.argv[4] ?? 'default';
const head = JSON.parse(process.argv[5] ?? '""');
const failing = new Map();
const exec = RegExp.prototype.exec;
RegExp.prototype.exec = function (text) {
  try {
    return exec.call(this, text);
  } catch (error) {
    if (error instanceof RangeError) {
      const key = `/${this.source.slice(0, 300)}/${this.flags}`;
      failing.set(key, (failing.get(key) ?? 0) + 1);
      // Keep going, so one run lists every overflowing expression.
      if (process.env.KEEP_GOING) {
        return null;
      }
    }
    throw error;
  }
};
const tail = `\n🔐 token refreshed — ok\npassword=xx-private-value\napi_key: xx-…789 Я\nemail: jane.doe@example.com — Иван Петров, +1 202 555 0143\n`;
const text = head + unit.repeat(Math.ceil((kib * 1024) / unit.length)) + tail;
const options = { maxInputLength: 64 * 1024 * 1024 };
try {
  const result =
    mode === 'credentials'
      ? createSyncSanitizer({ credentialsOnly: true, ...options }).sanitize(
          text
        )
      : await createSanitizer(options).sanitize(text);
  console.log('ok', result.redactions);
} catch (error) {
  console.log('failed', error.code ?? error.message);
}
for (const [source, count] of failing) {
  console.log(count, source);
}
