import { inspect, sanitize } from '../../src/index.js';

// Minimized public reproductions from issue 38; none contains private data.
const cases = [
  String.raw`{"payload":{"content":[{"text":"sig:' "},{"type":"","text":""}]}}`,
  String.raw`{"toolUseResult":{"stdout":"token for ES.\nes u"}}`,
  String.raw`{"toolUseResult":{"stdout":"SIG for\n:sig is d"}}`,
  String.raw`{"payload":{"content":[{"text":"token for\\ery record. The enclosing request-log write lock serio\\n/// this c"}]}}`,
  String.raw`{"payload":{"content":[{"text":"APIkey=\"\\\"private_key:9\""}]}}`,
];
const options = { profile: 'publication', structured: 'jsonl' };
for (const input of cases) {
  const findings = inspect(input, options).map((f) => ({
    rule: f.rule,
    type: f.type,
    value: input.slice(f.start, f.end),
  }));
  let output;
  try {
    output = sanitize(input, options).text;
  } catch (error) {
    output = error.code ?? String(error);
  }
  console.log(JSON.stringify({ input, findings, output }, null, 1));
}
