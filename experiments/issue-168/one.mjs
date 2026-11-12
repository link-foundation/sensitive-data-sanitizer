import { performance } from 'node:perf_hooks';
import { createSyncSanitizer } from '../../src/credentials-entry.js';
const engine = createSyncSanitizer({
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
});
const shape = process.argv[2] ?? 'bearer';
const make =
  shape === 'bearer'
    ? (i) => `line ${i} Authorization: Bearer 012…567`
    : (i) => `line ${i} token ghp…b4N`;
const text = `${Array.from({ length: 20000 }, (_, i) => make(i)).join('\n')}\n`;
const t = performance.now();
for (let o = 0; o < text.length; o += 256 * 1024) {
  engine.sanitize(text.slice(o, o + 256 * 1024));
}
console.log(shape, Math.round(performance.now() - t), 'ms');
if (globalThis.T) {
  console.log(globalThis.T);
}
