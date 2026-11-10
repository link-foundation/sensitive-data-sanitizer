// Measures the strict rule on a long mixed log so that new vocabulary stays cheap.
import { createSyncSanitizer } from '../../src/index.js';
import { performance } from 'node:perf_hooks';

const line =
  'INFO request completed in 12 ms; user note: работал в компании, живу в городе, served 200 OK\n';
const text = line.repeat(2000);
const s = createSyncSanitizer({ strict: true });
s.sanitize(line);
const start = performance.now();
s.sanitize(text);
console.log(
  'strict',
  text.length,
  'chars',
  (performance.now() - start).toFixed(1),
  'ms'
);
