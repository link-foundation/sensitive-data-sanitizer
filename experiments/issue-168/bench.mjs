// Issue #168: throughput of credentialsOnly sanitization on text that already
// contains hive-mask values (non-ASCII "…").
import { createSyncSanitizer } from '../../src/credentials-entry.js';
const engine = createSyncSanitizer({
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
});
const lines = Number(process.argv[2] ?? 20000);
const shapes = {
  plain: (i) => `line ${i} with ordinary words only`,
  numbers: (i) => `line ${i} 123456 7890 42`,
  githubMask: (i) => `line ${i} token ghp…b4N`,
  bearerMask: (i) => `line ${i} Authorization: Bearer 012…567`,
  both: (i) => `line ${i} token ghp…b4N Authorization: Bearer 012…567`,
};
for (const [name, make] of Object.entries(shapes)) {
  const text =
    Array.from({ length: lines }, (_, i) => make(i)).join('\n') + '\n';
  const started = performance.now();
  for (let o = 0; o < text.length; o += 256 * 1024) {
    engine.sanitize(text.slice(o, o + 256 * 1024));
  }
  const ms = performance.now() - started;
  console.log(
    name.padEnd(12),
    Math.round(text.length / 1024 / (ms / 1000)),
    'KB/s'
  );
}
