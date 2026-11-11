#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (
  args[0] !== 'stdin' ||
  !args.includes('--validation=false') ||
  !args.includes('--ignore-gitleaks-allow') ||
  !args.includes('--config') ||
  !args.includes('--gitleaks-ignore-path')
) {
  process.exit(3);
}
const config = readFileSync(args[args.indexOf('--config') + 1], 'utf8');
if (config !== '[extend]\nuseDefault = true\n') {
  process.exit(4);
}
const output = args[args.indexOf('--report-path') + 1];
const text = readFileSync(0, 'utf8');
const value = 'external-private-value';
writeFileSync(
  output,
  JSON.stringify(text.includes(value) ? [{ Secret: value }] : [])
);
