import { inspect, createSyncSanitizer } from '../../src/index.js';
const options = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
  structured: 'json',
  secretlint: false,
};
for (const input of [
  '{"age":34,"count":34}',
  '{"birthYear":1991,"year":1991}',
  '{"age":34,"note":"34"}',
  '{"age":34,"count":34,"note":"34","birthYear":1991,"year":1991}',
]) {
  console.log({ input, findings: inspect(input, options) });
  try {
    console.log(createSyncSanitizer(options).sanitize(input).text);
  } catch (error) {
    console.log(error.code);
  }
}
