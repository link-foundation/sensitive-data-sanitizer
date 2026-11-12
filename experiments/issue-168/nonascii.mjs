// Throughput of credentialsOnly sanitization on non-ASCII prose lines.
import { performance } from 'node:perf_hooks';
import { createSyncSanitizer } from '../../src/credentials-entry.js';
const engine = createSyncSanitizer({
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
});
const shapes = {
  cyrillic: (i) => `строка ${i} с обычными словами`,
  cjk: (i) => `第${i}行 普通的文字内容`,
  accents: (i) => `ligne ${i} réservée à l’équipe`,
};
for (const [name, make] of Object.entries(shapes)) {
  const text = `${Array.from({ length: 20000 }, (_, i) => make(i)).join('\n')}\n`;
  const rates = [];
  for (let round = 0; round < 2; round++) {
    const started = performance.now();
    for (let o = 0; o < text.length; o += 256 * 1024) {
      engine.sanitize(text.slice(o, o + 256 * 1024));
    }
    rates.push(
      Math.round(text.length / 1024 / ((performance.now() - started) / 1000))
    );
  }
  console.log(name.padEnd(10), rates.join(' / '), 'K chars/s (cold / warm)');
}
