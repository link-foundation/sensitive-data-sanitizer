// Sanitizes one long single-line run (issue 170).
// Usage: node probe-one.mjs <unit as JSON> <KiB> <credentials|default>
import { createSyncSanitizer } from '../../src/credentials-entry.js';
import { createSanitizer } from '../../src/index.js';
const [unitJson, kib, mode] = process.argv.slice(2);
const unit = JSON.parse(unitJson);
const secret = 'xx-private-value';
const text = `${unit.repeat(
  Math.ceil((Number(kib) * 1024) / unit.length)
)}\npassword=${secret}\n`;
const options = { maxInputLength: 64 * 1024 * 1024 };
try {
  const result =
    mode === 'credentials'
      ? createSyncSanitizer({ credentialsOnly: true, ...options }).sanitize(
          text
        )
      : await createSanitizer(options).sanitize(text);
  console.log(result.text.includes(secret) ? 'LEAK' : 'ok');
} catch (error) {
  console.log(error.code ?? error.message);
}
