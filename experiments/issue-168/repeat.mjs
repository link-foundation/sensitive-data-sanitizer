// Steady-state sanitize time for one 6,000-line slice of a given shape.
import { performance } from 'node:perf_hooks';
import { createSyncSanitizer } from '../../src/credentials-entry.js';
const engine = createSyncSanitizer({
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
});
const shapes = {
  gh: (i) => `line ${i} token ghp…b4N`,
  ghAscii: (i) => `line ${i} token ghp...b4N`,
  bearer: (i) => `line ${i} Authorization: Bearer 012…567`,
  bearerAscii: (i) => `line ${i} Authorization: Bearer 012...567`,
};
const make = shapes[process.argv[2] ?? 'gh'];
const text = `${Array.from({ length: 6000 }, (_, i) => make(i)).join('\n')}\n`;
for (let r = 0; r < Number(process.argv[3] ?? 4); r++) {
  const t = performance.now();
  engine.sanitize(text);
  console.log(r, Math.round(performance.now() - t), 'ms');
}
