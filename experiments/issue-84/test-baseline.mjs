// Run the actual regression suite against an archived source tree.
// Example: node experiments/issue-84/test-baseline.mjs /path/to/baseline/src/index.js
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
if (!process.argv[2]) {
  throw new Error('Supply a baseline src/index.js path');
}
const source = readFileSync(
  new URL('../../tests/sanitizer-issue-84.test.js', import.meta.url),
  'utf8'
)
  .replace(
    "'../src/index.js'",
    JSON.stringify(pathToFileURL(resolve(process.argv[2])).href)
  )
  .replace("'../experiments/issue-84/rows.mjs'", "'./rows.mjs'");
const target = fileURLToPath(new URL('.baseline.test.js', import.meta.url));
try {
  writeFileSync(target, source, { flag: 'wx' });
  const result = spawnSync(
    process.execPath,
    ['--test', '--test-timeout=30000', target],
    { stdio: 'inherit' }
  );
  process.exitCode = result.status ?? 1;
} finally {
  unlinkSync(target);
}
