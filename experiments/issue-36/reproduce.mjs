import { inspect, sanitize } from '../../src/index.js';
import {
  issue36Cases,
  jsonl,
} from '../../tests/fixtures/issue-36-sessions.mjs';

for (const fixture of issue36Cases) {
  const input = jsonl(fixture.records);
  const options = { profile: 'publication', structured: 'jsonl' };
  try {
    const findings = inspect(input, options);
    const result = sanitize(input, options);
    console.log(
      JSON.stringify({
        name: fixture.name,
        findings: findings.map(({ type, rule, start, end }) => ({
          type,
          rule,
          start,
          end,
        })),
        output: result.text,
      })
    );
  } catch (error) {
    console.log(JSON.stringify({ name: fixture.name, error: error.code }));
  }
}
