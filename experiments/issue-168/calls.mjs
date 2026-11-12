// Count detectContext calls in one sanitize call.
import { createSyncSanitizer } from '../../src/credentials-entry.js';
const engine = createSyncSanitizer({
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
});
const make = (i) => `line ${i} Authorization: Bearer 012…567`;
const text = `${Array.from({ length: 6000 }, (_, i) => make(i)).join('\n')}\n`;
engine.sanitize(text);
globalThis.CALLS = [];
engine.sanitize(text);
const counts = new Map();
for (const [len, stack] of globalThis.CALLS) {
  counts.set(
    `${len > 1000 ? 'big' : 'small'} ${stack}`,
    (counts.get(`${len > 1000 ? 'big' : 'small'} ${stack}`) ?? 0) + 1
  );
}
for (const [k, v] of counts) {
  console.log(v, k);
}
