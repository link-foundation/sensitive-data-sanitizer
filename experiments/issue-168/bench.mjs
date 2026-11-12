// Throughput of credentialsOnly sanitization on text that already
// contains hive-mask values (non-ASCII "…"), issue 168.
import { performance } from 'node:perf_hooks';
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
  githubAscii: (i) => `line ${i} token ghp...b4N`,
  bearerAscii: (i) => `line ${i} Authorization: Bearer 012...567`,
  both: (i) => `line ${i} token ghp…b4N Authorization: Bearer 012…567`,
};
for (const [name, make] of Object.entries(shapes)) {
  const text = `${Array.from({ length: lines }, (_, i) => make(i)).join('\n')}\n`;
  const rates = [];
  // The first round includes JIT warm-up for this shape; the second does not.
  for (let round = 0; round < 2; round++) {
    const started = performance.now();
    for (let o = 0; o < text.length; o += 256 * 1024) {
      engine.sanitize(text.slice(o, o + 256 * 1024));
    }
    const ms = performance.now() - started;
    rates.push(Math.round(text.length / 1024 / (ms / 1000)));
  }
  console.log(name.padEnd(12), rates.join(' / '), 'KB/s (cold / warm)');
}
