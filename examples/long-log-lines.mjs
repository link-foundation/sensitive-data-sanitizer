// Sanitize a log with a multi-megabyte single-line record next to emoji and
// masked values (issues 172 and 173). Run: node examples/long-log-lines.mjs
import { performance } from 'node:perf_hooks';
import { createSyncSanitizer } from '../src/credentials-entry.js';

const engine = createSyncSanitizer({ maxInputLength: 64 * 1024 * 1024 });
const log = [
  '✅ upload started — ok',
  `{"type":"image","data":"${'A'.repeat(6 * 1024 * 1024)}"}`,
  '🔐 token refreshed, password=xx-…789',
  `api_key: ${'Zm9v'.repeat(256 * 1024)}`,
  'password=hunter2-private',
  '',
].join('\n');
const started = performance.now();
const { text, findings } = engine.sanitize(log);
console.log(
  `${(log.length / 1024 / 1024).toFixed(1)} MiB in ${Math.round(performance.now() - started)} ms,`,
  `${findings.length} findings`
);
for (const line of text.split('\n')) {
  console.log(
    line.length > 80 ? `${line.slice(0, 60)}… (${line.length})` : line
  );
}
