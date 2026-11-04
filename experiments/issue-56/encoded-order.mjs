import { inspect, sanitize, createSanitizer } from '../../src/index.js';
const text = `John Smith then ${Buffer.from('Jane Doe met J. Doe').toString('base64')}`;
const options = {
  transformation: { mode: 'placeholder' },
  preserveEncoding: true,
};
console.log(text, inspect(text, options));
for (const result of [
  sanitize(text, options),
  await createSanitizer({ ...options, secretlint: false }).sanitize(text),
]) {
  console.log(JSON.stringify(result));
}
