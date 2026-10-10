import { inspect, sanitize } from '../../src/index.js';
for (const input of [
  JSON.stringify({
    toolUseResult: { file: { content: '\nasync applicant is\nasync f' } },
  }),
  JSON.stringify({ payload: { item: { content: [{ text: 'state:\nt' }] } } }),
  'state:\nt',
  'const userName = getUserName();',
]) {
  console.log(
    JSON.stringify({
      input,
      findings: inspect(input).map((f) => ({
        ...f,
        value: input.slice(f.start, f.end),
      })),
    })
  );
  try {
    console.log(JSON.stringify(sanitize(input)));
  } catch (e) {
    console.log(e.code);
  }
}
