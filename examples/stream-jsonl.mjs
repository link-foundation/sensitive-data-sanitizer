import { createReadStream } from 'node:fs';
import { sanitizeStreamToFile } from '../src/index.js';

const [source, target] = process.argv.slice(2);
if (!source || !target) {
  throw new Error(
    'Usage: node examples/stream-jsonl.mjs SOURCE.jsonl NEWFILE.jsonl'
  );
}
await sanitizeStreamToFile(createReadStream(source), target, {
  profile: 'publication',
  structured: 'jsonl',
  workers: 2,
});
console.log('Verified session written:', target);
