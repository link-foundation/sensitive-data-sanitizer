import { performance } from 'node:perf_hooks';
// Structured JSON cost per field (issue 165). Run: node experiments/issue-165/bench.mjs
import { createSyncSanitizer, sanitize } from '../../src/index.js';

const base = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  transformation: { mode: 'placeholder', map: false, existing: 'keep' },
};
function line(fields, salt = 0) {
  const r = { level: 'INFO', time: 1730000000000 + salt, msg: 'metric' };
  for (let i = 0; i < fields; i++) {
    r[`field${i}`] = i % 3 === 0 ? `value_${i}_ok` : i % 3 === 1 ? i * 7 : true;
  }
  return `${JSON.stringify(r)}\n`;
}
const variants = {
  'json documents+strict': createSyncSanitizer({ ...base, structured: 'json' }),
  'text documents+strict': createSyncSanitizer(base),
  'json documents': createSyncSanitizer({
    profile: 'documents',
    structured: 'json',
  }),
  'text documents': createSyncSanitizer({ profile: 'documents' }),
};
console.log('fields |', Object.keys(variants).join(' | '));
for (const fields of [2, 8, 16, 32]) {
  const row = Object.values(variants).map((s) => {
    for (let i = 0; i < 5; i++) {
      s.sanitize(line(fields, i));
    }
    const t = performance.now();
    for (let i = 0; i < 30; i++) {
      s.sanitize(line(fields, 100 + i));
    }
    return ((performance.now() - t) / 30).toFixed(2);
  });
  console.log(fields, row.join(' | '));
}
for (const fields of [2, 8, 32]) {
  let views = 0,
    cached = 0;
  sanitize(line(fields), {
    ...base,
    structured: 'json',
    debug: (e) => {
      if (e.event === 'structured-value') {
        views++;
        cached += e.cached ? 1 : 0;
      }
    },
  });
  console.log(
    `${fields} fields: ${views} structured views, ${views - cached} inspected`
  );
}
