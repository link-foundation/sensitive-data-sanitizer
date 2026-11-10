// Usage: node experiments/issue-142/inspect.mjs "<text, \\n for a line break>" [json-options]
import { createSyncSanitizer } from '../../src/index.js';
const text = process.argv[2].replace(/\\n/g, '\n');
const options = {
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
  ...JSON.parse(process.argv[3] ?? '{}'),
};
const s = createSyncSanitizer(options);
for (const f of s.inspect(text).findings ?? s.inspect(text)) {
  console.log(
    f.rule,
    f.start,
    f.end,
    JSON.stringify(text.slice(f.start, f.end))
  );
}
try {
  console.log('=>', JSON.stringify(s.sanitize(text).text ?? s.sanitize(text)));
} catch (error) {
  console.log('=> throws', error.code);
}
