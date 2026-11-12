// Prints the stack of the internal error behind ERR_SANITIZATION (issue 170).
// Usage: node experiments/issue-170/trace.mjs [MiB] [unit] [credentials|default]
import { createSanitizer } from '../../src/index.js';
const mib = Number(process.argv[2] ?? 10);
const unit = process.argv[3] ?? 'A_';
const text = `${unit.repeat(
  Math.ceil((mib * 1024 * 1024) / unit.length)
)}\npassword=xx-private-value\n`;
const sanitizer = createSanitizer({
  credentialsOnly: (process.argv[4] ?? 'credentials') === 'credentials',
  maxInputLength: 64 * 1024 * 1024,
});
try {
  const r = await sanitizer.sanitize(text);
  console.log('ok', r.redactions);
} catch (error) {
  let cause = error;
  while (cause?.cause) {
    cause = cause.cause;
  }
  console.log(error.code, cause?.stack ?? error.stack);
}
