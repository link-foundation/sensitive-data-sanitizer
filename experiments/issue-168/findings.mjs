// Show findings for already-masked credential lines.
import { inspect, sanitize } from '../../src/index.js';
const options = {
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
};
for (const line of [
  'line 1 Authorization: Bearer 012…567',
  'line 1 Authorization: Bearer 012...567',
  'line 1 token ghp…b4N',
  'Authorization: Bearer ghp…b4N',
  'Authorization: token ghp…b4N',
  'Authorization: Basic YWx…ZQ=',
  'Authorization: Bearer [REDACTED]',
]) {
  const found = inspect(line, options).map(
    (f) => `${f.rule}:${JSON.stringify(line.slice(f.start, f.end))}`
  );
  console.log(
    JSON.stringify(line),
    '=>',
    JSON.stringify(sanitize(line, options).text),
    found
  );
}
