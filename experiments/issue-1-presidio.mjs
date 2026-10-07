// Real optional NER integration; install dependencies/model separately.
// Run with an explicitly selected Python executable.
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createPresidioDetector, createSanitizer } from '../src/index.js';
const detector = createPresidioDetector({
  command: process.argv[2],
  args: [resolve('examples/presidio-bridge.py'), '--model', 'en_core_web_sm'],
});
const result = await createSanitizer({ detectors: [detector] }).sanitize(
  '😀 John Smith visited yesterday. password=short'
);
if (result.text.includes('John Smith') || result.text.includes('short')) {
  throw new Error('Expected synthetic PII and credential redaction.');
}
const cli = execFileSync(
  process.execPath,
  [
    resolve('bin/sensitive-data-sanitizer.js'),
    'redact',
    '-',
    '--presidio',
    resolve('examples/presidio-bridge.py'),
    '--python',
    process.argv[2],
    '--model',
    'en_core_web_sm',
    '--language',
    'en',
  ],
  { input: '😀 John Smith visited yesterday. password=short', encoding: 'utf8' }
);
if (cli !== result.text) {
  throw new Error('The real NER CLI and API outputs differ.');
}
console.log(
  JSON.stringify({
    text: result.text,
    rules: [...new Set(result.findings.map((f) => f.rule))],
  })
);
