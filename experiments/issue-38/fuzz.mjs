import { sanitize } from '../../src/index.js';

// Bounded random JSONL records built from credential-label fragments. Reports
// inputs that fail publication or need an extra residual-redaction round.
// Usage: node experiments/issue-38/fuzz.mjs [iterations] [seed]
const parts = [
  'token',
  'sig',
  'SIG',
  'sas',
  'secret',
  'key',
  'APIkey',
  'private_key',
  'password',
  'auth',
  'cookie',
  ' for ',
  ' is ',
  ' es ',
  ' est ',
  ':',
  '=',
  ' ',
  '\n',
  '\\n',
  '\\',
  '"',
  "'",
  '\\"',
  'ES.',
  'request',
  'record',
  'abc123XYZ',
  '9',
  'd',
  'u',
  'value',
  '[',
  ']',
  '{',
  '}',
  ',',
];
let seed = Number(process.argv[3] ?? 38);
const random = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const iterations = Number(process.argv[2] ?? 2000);
const counts = { ok: 0, rounds: 0 };
const samples = {};
for (let i = 0; i < iterations; i++) {
  const text = Array.from(
    { length: 1 + Math.floor(random() * 8) },
    () => parts[Math.floor(random() * parts.length)]
  ).join('');
  const input = `${JSON.stringify({ payload: { content: [{ text }, { type: '', text: '' }] } })}\n`;
  let rounds = 0;
  try {
    sanitize(input, {
      profile: 'publication',
      structured: 'jsonl',
      debug: (event) => {
        if (event.event === 'residual-redaction') {
          rounds++;
        }
      },
    });
    counts.ok++;
    if (rounds) {
      counts.rounds++;
      samples.rounds ??= [];
      if (samples.rounds.length < 5) {
        samples.rounds.push(text);
      }
    }
  } catch (error) {
    counts[error.code] = (counts[error.code] ?? 0) + 1;
    samples[error.code] ??= [];
    if (samples[error.code].length < 5) {
      samples[error.code].push(text);
    }
  }
}
console.log(JSON.stringify({ counts, samples }, null, 1));
