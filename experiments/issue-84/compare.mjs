import { pathToFileURL } from 'node:url';
import { rows } from './rows.mjs';
const { sanitize } = await import(
  process.argv[2] ? pathToFileURL(process.argv[2]) : '../../src/index.js'
);
for (const { issue, input, limit } of rows) {
  const output = sanitize(input, { profile: 'documents' }).text;
  console.log(
    JSON.stringify({ issue, input, output, limit, changed: input !== output })
  );
}
