import { inspect, redact } from '../../src/index.js';
const raw = '"\\",ООО\\\\\\"Р\\\\\\"\\""';
let input = JSON.stringify({ output: raw });
for (let round = 0; round < 5; round++) {
  const findings = inspect(input, { profile: 'documents', structured: 'json' });
  console.log(
    round,
    JSON.stringify(input),
    findings.map((f) => ({ ...f, value: input.slice(f.start, f.end) }))
  );
  try {
    input = redact(input, findings, {
      profile: 'documents',
      structured: 'json',
    });
  } catch (e) {
    console.log(e.code);
    break;
  }
}
