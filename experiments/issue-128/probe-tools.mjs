#!/usr/bin/env node
// Groups probe misses and over-redactions by competitor tool so the case study
// can state which upstream fixtures remain different by design. Usage:
//   node experiments/issue-128/probe-tools.mjs [options-json]
import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const research = fileURLToPath(
  new URL('../../docs/case-studies/issue-128/research/', import.meta.url)
);
const options = process.argv[2] ?? '{}';
console.log('| Case set | Tool | Misses | Over-redactions |');
console.log('| --- | --- | --- | --- |');
for (const set of ['open-source-pii', 'open-source-secrets', 'closed-source']) {
  const output = execFileSync(
    process.execPath,
    [
      `${here}probe-cases.mjs`,
      `${research}${set}-cases.json`,
      '--options',
      options,
      '--json',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  const { misses, overRedactions } = JSON.parse(output);
  const tools = new Map();
  const count = (entry, field) => {
    const row = tools.get(entry.tool) ?? { misses: 0, over: 0 };
    row[field]++;
    tools.set(entry.tool, row);
  };
  misses.forEach((entry) => count(entry, 'misses'));
  overRedactions.forEach((entry) => count(entry, 'over'));
  for (const [tool, row] of [...tools].sort()) {
    console.log(`| ${set} | ${tool} | ${row.misses} | ${row.over} |`);
  }
}
