// Fuzzes shortenedView (issue 173): for the three targeted rules, RE2 on the
// shortened view must find the same matches, at the same original offsets,
// with the same secrets, as RE2 on the full view.
// Usage: node equivalence.mjs [cases] [seed]
import { RE2JS } from 're2js';
import { gitleaksRules, shortenedView } from '../../src/gitleaks.js';
const cases = Number(process.argv[2] ?? 1500);
let seed = Number(process.argv[3] ?? 1);
const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (items) => items[Math.floor(random() * items.length)];
const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const longRun = () => {
  const length = 900 + Math.floor(random() * 3000);
  const mode = random();
  let run = '';
  for (let i = 0; i < length; i++) {
    run += mode < 0.3 ? 'A' : mode < 0.5 ? pick(['key', 'token', 'K', 'e', 'y', 'a']) : b64[Math.floor(random() * 64)];
  }
  return run.slice(0, length);
};
const pieces = [
  'password', 'api_key', 'API', 'Api', 'token', 'secret', 'credential', 'sonar_token', 'sonar.login',
  'administrator_login_password', 'my.', 'db_', 'x-', '=', '= ', ': ', ':=', '=>', '||', '?=', ',', '>',
  '"', "'", '`', ' ', '\t', '\n', ';', '\\n', '==', '===', '====', '_', '.', '-', '/', '+', 'abc123',
  'squ_', 'é', '😀', 'Zx9', '0123456789abcdef',
];
const rules = gitleaksRules.filter((rule) => ['generic-api-key', 'hashicorp-tf-password', 'sonar-api-token'].includes(rule.id));
const compiled = rules.map((rule) => [rule, RE2JS.compile(rule.regex)]);
const secretOf = (rule, match) => (rule.secretGroup ? match[rule.secretGroup] : (match.slice(1).find(Boolean) ?? match[0]));
let shortened = 0, matches = 0;
for (let n = 0; n < cases; n++) {
  let text = '';
  const count = 2 + Math.floor(random() * 14);
  for (let i = 0; i < count; i++) {
    const roll = random();
    text +=
      roll < 0.3
        ? longRun()
        : roll < 0.55
          ? // A structured `key = value` assignment, often with a long value.
            pick(['', 'my_', 'db.', 'x-']) + pick(['password', 'api_key', 'token', 'sonar_token', 'administrator_login_password', 'secret']) +
            pick(['', ' ', '_x']) + pick(['=', ': ', ':=', '=>', ',']) + pick(['', '"', ' ', '=']) +
            (random() < 0.6 ? longRun() : pick(['abc123XYZ987', 'squ_' + '0123456789abcdef'.repeat(3)])) +
            pick(['', '=', '==', '===', '====']) + pick(['\n', '"', ' ', ';', '\\n', '', '_', 'é'])
          : pick(pieces);
  }
  const view = shortenedView(text, 0);
  if (!view.source) continue;
  shortened++;
  for (const [rule, re] of compiled) {
    const full = [...re.matchAll(text)].map((m) => {
      const secret = secretOf(rule, m);
      return secret ? [m.index, m.index + m[0].length, secret, m.index + m[0].indexOf(secret)] : [m.index, m.index + m[0].length];
    });
    const short = [...re.matchAll(view.text)].map((m) => {
      const secret = secretOf(rule, m);
      const end = view.position(m.index + m[0].length);
      if (!secret) return [view.position(m.index), end];
      const offset = m.index + m[0].indexOf(secret);
      const start = view.position(offset);
      return [view.position(m.index), end, text.slice(start, view.position(offset + secret.length)), start];
    });
    matches += full.length;
    if (JSON.stringify(full) !== JSON.stringify(short)) {
      console.log('DIFF', rule.id, JSON.stringify(text.slice(0, 200)), JSON.stringify(full).slice(0, 400), JSON.stringify(short).slice(0, 400));
      process.exit(1);
    }
  }
}
console.log(cases, 'cases,', shortened, 'shortened,', matches, 'matches compared, no difference');
