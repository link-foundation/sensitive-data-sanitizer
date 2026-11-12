// Time detectContext alone on a bearer-mask slice (steady state).
import { performance } from 'node:perf_hooks';
import { detectContext } from '../../src/context.js';
const make = (i) => `line ${i} Authorization: Bearer 012…567`;
const text = `${Array.from({ length: 6000 }, (_, i) => make(i)).join('\n')}\n`;
for (let r = 0; r < 4; r++) {
  let n = 0;
  const t = performance.now();
  detectContext(text, () => n++, true);
  console.log(r, Math.round(performance.now() - t), 'ms', n, 'findings');
}
