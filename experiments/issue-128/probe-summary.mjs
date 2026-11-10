#!/usr/bin/env node
// Prints a markdown table of probe results for every collected case file and
// option set. Usage: node experiments/issue-128/probe-summary.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const research = fileURLToPath(
  new URL('../../docs/case-studies/issue-128/research/', import.meta.url)
);
const sets = ['open-source-pii', 'open-source-secrets', 'closed-source'];
const variants = [
  ['default', {}],
  ['strict, publicKnowledge:false', { strict: true, publicKnowledge: false }],
  [
    'strict, publicKnowledge:false, paranoid',
    { strict: true, publicKnowledge: false, paranoid: true },
  ],
];
console.log(
  '| Case set | Options | Total | Skipped | Misses | Over-redactions |'
);
console.log('| --- | --- | --- | --- | --- | --- |');
for (const set of sets) {
  for (const [label, options] of variants) {
    const output = execFileSync(
      process.execPath,
      [
        `${here}probe-cases.mjs`,
        `${research}${set}-cases.json`,
        '--options',
        JSON.stringify(options),
        '--json',
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );
    const { summary } = JSON.parse(output);
    console.log(
      `| ${set} | ${label} | ${summary.total} | ${summary.skipped} | ${summary.misses} | ${summary.overRedactions} |`
    );
  }
}
