import { inspect, redact } from '../../src/index.js';

// Shows the full-redaction text and the residual findings that block publication.
const cases = [
  String.raw`{"toolUseResult":{"stdout":"token for ES.\nes u"}}`,
  String.raw`{"toolUseResult":{"stdout":"SIG for\n:sig is d"}}`,
  String.raw`{"payload":{"content":[{"text":"token for\\ery record. The enclosing request-log write lock serio\\n/// this c"}]}}`,
  String.raw`{"payload":{"content":[{"text":"APIkey=\"\\\"private_key:9\""}]}}`,
];
const options = { profile: 'publication', structured: 'jsonl' };
for (const input of cases) {
  const findings = inspect(input, options);
  const text = redact(input, findings, {
    ...options,
    identityMask: false,
    preserveEncoding: false,
  });
  const residual = inspect(text, { ...options, findings: [] }).map((f) => ({
    rule: f.rule,
    value: text.slice(f.start, f.end),
  }));
  console.log(JSON.stringify({ text, residual }));
}
