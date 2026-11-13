// Prints whether each multi-line netrc entry leaks when streamed in tiny chunks.
import { sanitizeStream } from '../../src/index.js';
const secret = 'Zx9-netrc-fixture-Value-2026';
for (const entry of [
  `machine api.example.net\nlogin alice\npassword ${secret}\n`,
  `default\nlogin alice\npassword ${secret}\n`,
  `machine api.example.net login alice\npassword ${secret}\n`,
  `prefix text default\nlogin alice password ${secret}\n`,
]) {
  const input = `INFO first\n${entry}INFO last\n`;
  const out = [];
  for await (const c of sanitizeStream(Array.from(input), {
    credentialsOnly: true,
    secretlint: false,
    batchBytes: 8,
  })) {
    out.push(c);
  }
  console.log(
    JSON.stringify(entry),
    out.join('').includes(secret) ? 'LEAKED' : 'redacted'
  );
}
