// A window with more decodable candidates than the per-window budget (issue 139).
import { performance } from 'node:perf_hooks';
import { inspect, sanitize } from '../../src/index.js';
const text = Array.from(
  { length: 6000 },
  (_, i) => `&#${48 + (i % 10)};&#65;`
).join(' ');
let t = performance.now();
const findings = inspect(text, { credentialsOnly: true });
console.log(
  'length',
  text.length,
  'findings',
  findings.length,
  [...new Set(findings.map((f) => f.rule))],
  Math.round(performance.now() - t),
  'ms'
);
t = performance.now();
const out = sanitize(text, { credentialsOnly: true }).text;
console.log(
  'changed',
  out !== text,
  Math.round(performance.now() - t),
  'ms',
  out.slice(-60)
);
