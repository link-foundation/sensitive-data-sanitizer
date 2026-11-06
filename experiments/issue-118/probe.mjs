import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { sanitize } from '../../src/index.js';
for (const n of [113, 115, 116, 117]) {
  const body = JSON.parse(
    readFileSync(new URL(`./issue-${n}.json`, import.meta.url))
  ).body;
  let control = false;
  for (const line of body.split('\n')) {
    if (/Must stay/.test(line)) {
      control = true;
    }
    const m = /^(?:- |\| )`([^`]+)`/.exec(line);
    if (!m) {
      continue;
    }
    const text = m[1];
    try {
      const out = sanitize(text, {
        profile: 'documents',
        ...(n === 116 ? { strict: true } : {}),
      }).text;
      console.log(
        JSON.stringify({ issue: n, control, text, out, changed: text !== out })
      );
    } catch (error) {
      console.log(JSON.stringify({ issue: n, text, error: error.code }));
    }
  }
}
