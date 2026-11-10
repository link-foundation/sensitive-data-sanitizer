// Prints findings for each argument: node why.mjs "text" ...
import { inspect } from '../../src/index.js';
for (const text of process.argv.slice(2)) {
  console.log(JSON.stringify(text));
  for (const f of inspect(text, { minConfidence: 0 })) {
    console.log(
      `  ${f.type} ${f.rule} ${f.confidence} ${JSON.stringify(text.slice(f.start, f.end))}`
    );
  }
}
