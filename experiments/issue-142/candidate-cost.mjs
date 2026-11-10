import { createSyncSanitizer } from '../../src/index.js';
import { performance } from 'node:perf_hooks';
const GH = ['ghp_', 'Zx9Qw7Er5Ty3Ui1Op0As', '2Df4Gh6Jk8Lz0Xc2Vb4N'].join('');
const s = createSyncSanitizer({
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
});
for (const n of [1000, 4000]) {
  const words = Array.from({ length: n }, (_, i) =>
    Buffer.from(`chunk number ${i} ok`).toString('base64')
  ).join('\n');
  const t = performance.now();
  s.sanitize(`${words}\ntoken: ${GH}`);
  console.log(n, performance.now() - t);
  const plain = Array.from(
    { length: n },
    (_, i) => `chunk number ${i} ok`
  ).join('\n');
  const t2 = performance.now();
  s.sanitize(`${plain}\ntoken: ${GH}`);
  console.log('plain', n, performance.now() - t2);
}
