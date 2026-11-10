// Prints the findings behind each issue 130 proper-name example.
import { inspect } from '../../src/index.js';

const options = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
};
for (const text of process.argv.slice(2)) {
  console.log(JSON.stringify(text));
  for (const f of inspect(text, options)) {
    console.log(
      ' ',
      f.start,
      f.end,
      f.type,
      f.rule,
      f.confidence,
      JSON.stringify(text.slice(f.start, f.end))
    );
  }
}
