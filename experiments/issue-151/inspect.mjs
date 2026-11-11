import { createSyncSanitizer } from '../../src/credentials-entry.js';
const engine = createSyncSanitizer({ transformation: { mode: 'hive-mask' } });
for (const text of [
  'set `password=<secret>` in the config',
  '`-c model_auto_compact_token_limit=<tokens>` overrides.',
  '`HIVE_MIND_CLAUDE_AUTH_AUTHORITY=conventional` to opt out.',
  'Use `password=${PASSWORD}` here.',
  'Use `token: token credential-Material-123456789` here.',
]) {
  console.log(
    JSON.stringify({
      text,
      findings: engine.inspect(text),
      result: engine.sanitize(text).text,
    })
  );
}
