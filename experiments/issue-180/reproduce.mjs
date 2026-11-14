import { inspect, sanitize } from '../../src/index.js';
import { projectText } from '../../src/projection.js';

const token = `ghp_${'x'.repeat(36)}`;
const inputs = [
  `line\0one ${token}\0two\n`,
  `line\0one ${token}\0two three\n`,
  `token=${token}\0two\n`,
  `password=sample-value\0two\n`,
  `Authorization: Bearer abc\0two\n`,
  [...token].join('\0'),
];

for (const input of inputs) {
  console.log(
    JSON.stringify({
      input,
      view: projectText(input).text,
      output: sanitize(input, { credentialsOnly: true }).text,
      findings: inspect(input, { credentialsOnly: true }).map(
        ({ start, end, rule }) => ({ start, end, rule })
      ),
    })
  );
}
