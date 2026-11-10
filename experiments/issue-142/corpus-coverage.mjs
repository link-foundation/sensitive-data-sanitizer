// Lists benchmark corpus truth spans that the default engine no longer covers.
import { corpus } from '../benchmark/corpus.mjs';
import { createSanitizer } from '../../src/index.js';
const engine = createSanitizer();
for (const entry of corpus) {
  const findings = await engine.inspect(entry.text);
  for (const truth of entry.spans) {
    let cursor = truth.start;
    for (const f of findings) {
      if (f.start <= cursor && f.end > cursor) {
        cursor = f.end;
      }
    }
    if (cursor < truth.end) {
      console.log(
        JSON.stringify(
          entry.text.slice(Math.max(0, truth.start - 30), truth.end + 10)
        )
      );
      console.log(
        '  truth',
        JSON.stringify(entry.text.slice(truth.start, truth.end)),
        'covered to',
        cursor - truth.start
      );
      console.log(
        '  findings',
        findings
          .map(
            (f) =>
              `${f.rule}:${JSON.stringify(entry.text.slice(f.start, f.end))}`
          )
          .join(' ')
      );
    }
  }
}
