// Sanitizes one long single-line run followed by a two-byte tail that holds
// credential and personal-data cues (issue 172).
// Usage: SENSITIVE_DATA_SANITIZER_DEBUG=1 node probe-one.mjs <unit JSON> <KiB> <credentials|default|file> [tail JSON]
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSyncSanitizer } from '../../src/credentials-entry.js';
import { createSanitizer, sanitizeFileToFile } from '../../src/index.js';
const [unitJson, kib, mode, tailJson] = process.argv.slice(2);
const unit = JSON.parse(unitJson);
const secret = 'xx-private-value';
const tail = tailJson
  ? JSON.parse(tailJson)
  : `\n🔐 token refreshed — ok\npassword=${secret}\napi_key: xx-…789 Я\nemail: jane.doe@example.com — Иван Петров, +1 202 555 0143\n`;
const text = `${unit.repeat(Math.ceil((Number(kib) * 1024) / unit.length))}${tail}`;
const options = { maxInputLength: 64 * 1024 * 1024 };
try {
  let output;
  if (mode === 'credentials') {
    output = createSyncSanitizer({
      credentialsOnly: true,
      ...options,
    }).sanitize(text).text;
  } else if (mode === 'file') {
    const dir = mkdtempSync(join(tmpdir(), 'issue-172-'));
    try {
      writeFileSync(join(dir, 'in.log'), text);
      await sanitizeFileToFile(
        join(dir, 'in.log'),
        join(dir, 'out.log'),
        options
      );
      output = readFileSync(join(dir, 'out.log'), 'utf8');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  } else {
    output = (await createSanitizer(options).sanitize(text)).text;
  }
  console.log(tail.includes(secret) && output.includes(secret) ? 'LEAK' : 'ok');
} catch (error) {
  console.log(error.code ?? error.message);
}
