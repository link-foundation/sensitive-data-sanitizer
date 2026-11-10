#!/usr/bin/env node
// Runs collected competitor cases through the synchronous sanitizer and
// reports positives whose sensitive substrings survive and negatives that
// were changed. Usage:
//   node experiments/issue-128/probe-cases.mjs <cases.json> [--profile publication]
//     [--options '{"strict":true,"publicKnowledge":false}'] [--json]
import { readFileSync } from 'node:fs';
import { sanitize } from '../../src/index.js';
import { fillCase } from './fill-template.mjs';

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error(
    'usage: probe-cases.mjs <cases.json> [--profile NAME] [--json]'
  );
  process.exit(2);
}
const profileIndex = flags.indexOf('--profile');
const optionsIndex = flags.indexOf('--options');
const options = {
  ...(optionsIndex >= 0 ? JSON.parse(flags[optionsIndex + 1]) : {}),
  ...(profileIndex >= 0 ? { profile: flags[profileIndex + 1] } : {}),
};
const cases = JSON.parse(readFileSync(file, 'utf8'));
const misses = [];
const overRedactions = [];
let skipped = 0;
for (const [index, raw] of cases.entries()) {
  const entry =
    typeof raw.input === 'string' ? fillCase(raw, index + 1) : undefined;
  if (!entry || entry.input.includes('{{')) {
    skipped++;
    continue;
  }
  const output = sanitize(entry.input, options).text;
  if (entry.negative) {
    if (output !== entry.input) {
      overRedactions.push({ ...entry, output });
    }
    continue;
  }
  const survived = (entry.sensitive ?? []).filter(
    (value) => value && output.includes(value)
  );
  if (survived.length > 0) {
    misses.push({ ...entry, survived, output });
  }
}
const summary = {
  total: cases.length,
  skipped,
  misses: misses.length,
  overRedactions: overRedactions.length,
};
if (flags.includes('--json')) {
  console.log(JSON.stringify({ summary, misses, overRedactions }, null, 2));
} else {
  console.log(summary);
  for (const miss of misses) {
    console.log(
      `MISS [${miss.tool}] ${JSON.stringify(miss.types ?? [])} ${JSON.stringify(miss.survived)}\n  in:  ${miss.input}\n  out: ${miss.output}`
    );
  }
  for (const over of overRedactions) {
    console.log(
      `OVER [${over.tool}] ${over.notes ?? ''}\n  in:  ${over.input}\n  out: ${over.output}`
    );
  }
}
