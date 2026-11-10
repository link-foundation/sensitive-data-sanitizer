// Usage: node experiments/issue-142/inspect-async.mjs "<text, \\n for a line break>" [json-options]
// Same as inspect.mjs but through the async engine (secretlint included).
import { createSanitizer } from '../../src/index.js';
const text = process.argv[2].replace(/\\n/g, '\n');
const engine = createSanitizer(JSON.parse(process.argv[3] ?? '{}'));
for (const f of await engine.inspect(text)) {
  console.log(
    f.rule,
    f.start,
    f.end,
    JSON.stringify(text.slice(f.start, f.end))
  );
}
try {
  console.log('=>', JSON.stringify((await engine.sanitize(text)).text));
} catch (error) {
  console.log('=> throws', error.code);
}
