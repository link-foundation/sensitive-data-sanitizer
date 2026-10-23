import { performance } from 'node:perf_hooks';
import { serviceRules } from '../../src/rules.js';
import { decodedRuns } from '../../src/encoded.js';
import { detectContext } from '../../src/context.js';
import { detectPersonal } from '../../src/personal.js';
import { detectGitleaks } from '../../src/gitleaks.js';
import { projectText } from '../../src/projection.js';
const size = Number(process.argv[2] ?? 100000);
if (!Number.isSafeInteger(size) || size < 1 || size > 16000000) {
  throw Error('bounded size required');
}
let state = 43;
const bytes = Buffer.alloc((size * 3) / 4);
for (let i = 0; i < bytes.length; i++) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  bytes[i] = state >>> 24;
}
const text = JSON.stringify({ image: bytes.toString('base64') });
for (const [name, detect] of [
  ...serviceRules.map(([name, regex]) => [
    name,
    () => [...text.matchAll(regex)],
  ]),
  ['projection', () => projectText(text)],
  ['context', () => detectContext(text, () => {})],
  ['personal', () => detectPersonal(text, () => {})],
  [
    'gitleaks',
    () =>
      detectGitleaks(
        text,
        () => {},
        (trace) => console.log(JSON.stringify(trace))
      ),
  ],
  ['decoded', () => [...decodedRuns(text)]],
]) {
  const start = performance.now();
  console.log('start', name);
  detect();
  console.log(JSON.stringify({ name, size, ms: performance.now() - start }));
}
