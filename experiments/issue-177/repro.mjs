// Prints credentials-only output for the Authorization samples from #177.
import { createSyncSanitizer } from '../../src/credentials-entry.js';
// Built at runtime so secret scanners do not flag the fixture.
const token = ['ghp', '0123456789abcdefABCDEF0123456789abcd'].join('_');
const s = createSyncSanitizer({ credentialsOnly: true });
for (const input of [
  'Authorization: token <value>',
  '"Authorization: token <value>"',
  '`Authorization: token <value>`',
  '`Authorization: Bearer <token>` header',
  '`Authorization: Bearer $TOKEN`',
  '`Authorization: Bearer ${TOKEN}`',
  `\`Authorization: token ${token}\` after`,
  '`Authorization: Bearer abcdefghijklmnopqrstuvwx1234` after',
  'Fix masking in `Authorization: token <value>` (and any other scheme)',
]) {
  const spans = s.inspect(input).map((f) => input.slice(f.start, f.end));
  console.log(
    JSON.stringify(input),
    '=>',
    JSON.stringify(s.sanitize(input).text),
    JSON.stringify(spans)
  );
}
