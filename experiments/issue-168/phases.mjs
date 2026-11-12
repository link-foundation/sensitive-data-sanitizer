// Time the main phases of one credentialsOnly sanitize call on a slice.
import { performance } from 'node:perf_hooks';
import { createSyncSanitizer } from '../../src/credentials-entry.js';
import { nativeDetect } from '../../src/detection.js';
import { projectText } from '../../src/projection.js';
const options = {
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
};
const engine = createSyncSanitizer(options);
const make = {
  bearer: (i) => `line ${i} Authorization: Bearer 012…567`,
  bearerAscii: (i) => `line ${i} Authorization: Bearer 012...567`,
  gh: (i) => `line ${i} token ghp…b4N`,
  plain: (i) => `line ${i} with ordinary words only`,
}[process.argv[2] ?? 'bearer'];
const text = `${Array.from({ length: 6000 }, (_, i) => make(i)).join('\n')}\n`;
const time = (label, fn) => {
  const t = performance.now();
  const r = fn();
  console.log(label.padEnd(10), Math.round(performance.now() - t), 'ms');
  return r;
};
time('warm', () => engine.sanitize(text.slice(0, 2000)));
time('sanitize', () => engine.sanitize(text));
const view = time('project', () => projectText(text)).text;
let n = 0;
time('native', () =>
  nativeDetect(view, { ...options, knownSecrets: [] }, () => n++)
);
console.log('findings', n, 'chars', text.length);
console.log(globalThis.T);
