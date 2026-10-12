import { performance } from 'node:perf_hooks';
import { URL } from 'node:url';
import { createSanitizer } from '../../src/index.js';
import { readFile } from 'node:fs/promises';
const engine = createSanitizer({ profile: 'publication' });
const body = (n) =>
  Array.from(
    { length: n },
    (_, i) => `  const value${i} = compute(${i});`
  ).join('\n');
const cases = {
  source: JSON.stringify({
    content: `function parse() {\n  found.phone = number;\n${body(900)}\n}`,
  }),
  prompt: JSON.stringify({
    text: `# Security Policy\n- Organization: default generic organization / personal user.\n${body(400)}`,
  }),
  identifier: 'root_turn_id',
  ci: await readFile(
    new URL('../../tests/fixtures/issue-34-ci.json', import.meta.url),
    'utf8'
  ),
  surrogate: JSON.stringify({
    text: 'email: zoe@private.invalid\nemoji 😀 lone \ud83d',
  }),
};
for (const [name, input] of Object.entries(cases)) {
  const started = performance.now();
  try {
    const result = await engine.sanitize(input);
    console.log(
      JSON.stringify({
        name,
        input: input.length,
        output: result.text.length,
        ms: Math.round(performance.now() - started),
        rules: [...new Set(result.findings.map((f) => `${f.type}:${f.rule}`))],
      })
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        name,
        code: error.code ?? error.name,
        ms: Math.round(performance.now() - started),
      })
    );
  }
}
