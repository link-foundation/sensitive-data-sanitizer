import { inspect, sanitize } from '../../src/index.js';
import { confirmationOptions } from '../../src/propagation.js';
import { encodedValue } from '../../src/encoded.js';
import { mrzName, mrzData } from '../../tests/fixtures/identity.js';

function probe(text, options = {}, depth = 0) {
  const findings = inspect(text, options);
  console.log({ depth, text, findings });
  for (const finding of findings) {
    if (finding.type !== 'ENCODED_SENSITIVE' || depth >= 2) {
      continue;
    }
    const raw = text.slice(finding.start, finding.end);
    const run = encodedValue(raw);
    console.log({ raw, run });
    if (run) {
      probe(
        run.text,
        {
          ...confirmationOptions(text, findings, options),
          preserveEncoding: true,
        },
        depth + 1
      );
    }
  }
}
const input = JSON.stringify({ text: `${mrzName}\n${mrzData}` });
probe(input);
console.log(sanitize(input));
