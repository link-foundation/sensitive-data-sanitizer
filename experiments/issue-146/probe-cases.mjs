// Run all collected cases, retaining safe case IDs when one fails closed.
import { readFileSync, writeFileSync } from 'node:fs';
import { sanitize } from '../../src/index.js';
import { fillCase } from '../issue-128/fill-template.mjs';
const sets = ['open-source-pii', 'open-source-secrets', 'closed-source'];
const results = [];
for (const set of sets) {
  const cases = JSON.parse(
    readFileSync(
      `docs/case-studies/issue-128/research/${set}-cases.json`,
      'utf8'
    )
  );
  const summary = {
    set,
    total: cases.length,
    skipped: 0,
    misses: 0,
    overRedactions: 0,
    errors: 0,
    cases: [],
  };
  for (const [index, raw] of cases.entries()) {
    const entry =
      typeof raw.input === 'string' ? fillCase(raw, index + 1) : undefined;
    if (!entry || entry.input.includes('{{')) {
      summary.skipped++;
      continue;
    }
    const metadata = {
      index,
      tool: raw.tool,
      types: raw.types,
      source: raw.source,
    };
    try {
      const output = sanitize(entry.input).text;
      const outcome = entry.negative
        ? output !== entry.input
          ? 'overRedactions'
          : undefined
        : entry.sensitive?.some((value) => value && output.includes(value))
          ? 'misses'
          : undefined;
      if (outcome) {
        summary[outcome]++;
        summary.cases.push({ ...metadata, outcome });
      }
    } catch (error) {
      summary.errors++;
      summary.cases.push({ ...metadata, outcome: 'errors', code: error.code });
    }
  }
  results.push(summary);
  console.log(JSON.stringify({ ...summary, cases: undefined }));
}
if (process.argv[2]) {
  writeFileSync(process.argv[2], `${JSON.stringify(results, null, 2)}\n`);
}
