import { inspect, redact, createSanitizer } from '../src/index.js';
import { rules } from '@secretlint/secretlint-rule-preset-recommend';

for (const input of ['Имя: Иван Петров', 'name: Zoë Dubois', 'password=1234']) {
  const findings = inspect(input);
  const output = redact(input, findings);
  console.log({ input, findings, output, residual: inspect(output) });
}
console.log(rules.map((rule) => ({ id: rule.meta.id, type: rule.meta.type })));
const github = `ghp_${'a'.repeat(36)}`;
console.log(
  await createSanitizer().inspect(`// secretlint-disable\n${github}`)
);
