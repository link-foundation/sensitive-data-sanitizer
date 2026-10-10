// Pass an isolated npm prefix after installing this branch's npm pack archive.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const prefix = process.argv[2];
assert(prefix, 'An isolated installation prefix is required');
const root = resolve(
  prefix,
  'node_modules/@link-foundation/sensitive-data-sanitizer'
);
const cli = resolve(root, 'bin/sensitive-data-sanitizer.js');
const manifest = JSON.parse(
  readFileSync(resolve(root, 'package.json'), 'utf8')
);
const version = execFileSync(process.execPath, [cli, '--version'], {
  encoding: 'utf8',
}).trim();
assert.equal(version, manifest.version);
const { createSanitizer } = await import(
  pathToFileURL(resolve(root, 'src/index.js'))
);
assert.equal(
  (await createSanitizer().sanitize('112-233-445 95')).text,
  '[REDACTED]'
);
const input = `${[
  { payload: { item: { content: [{ text: 'Applicant: Qazvela Zorveta' }] } } },
  {
    toolUseResult: {
      file: { content: 'saved qazvela.pdf\nstate:\nt\npassport: 46 21 573918' },
    },
  },
]
  .map(JSON.stringify)
  .join('\n')}\n`;
const output = execFileSync(
  process.execPath,
  [cli, 'redact', '-', '--jsonl', '--stream'],
  {
    input,
    encoding: 'utf8',
  }
);
assert(!output.toLowerCase().includes('qazvela'));
assert(!output.includes('573918'));
assert.equal(output.trim().split('\n').map(JSON.parse).length, 2);
console.log(
  JSON.stringify({ version, api: 'passed', installedCli: 'passed', records: 2 })
);
