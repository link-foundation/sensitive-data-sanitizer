import { it, expect } from 'test-anywhere';
import { RE2 } from 're2-wasm';
import { detectGitleaks, gitleaksRules } from '../src/gitleaks.js';
import { entropy } from '../src/detection.js';

it('retains complete vendored generic credential matches through keyword-window boundaries', () => {
  const rules = gitleaksRules.filter((r) =>
    ['generic-api-key', 'hashicorp-tf-password'].includes(r.id)
  );
  for (const input of [
    `${'🙂 ordinary '.repeat(80)}service_api_key = "aB3cD4eF5gH6iJ7kL8mN"\n`,
    `password\n=\n${'aB3cD4eF5gH6iJ7kL8mN'.repeat(50)}\\nnext`,
    'administrator_login_password = "ab3cd4ef5gh6ij7k";',
    'authorization: aB3cD4eF5gH6iJ7kL8mN\npassword=aB3cD4eF5gH6iJ7kL8mN',
  ]) {
    const found = [];
    detectGitleaks(input, (f) => found.push(f));
    for (const rule of rules) {
      const pattern = new RE2(rule.regex, 'gu');
      let match;
      while ((match = pattern.exec(input))) {
        const secret = rule.secretGroup
          ? match[rule.secretGroup]
          : (match.slice(1).find(Boolean) ?? match[0]);
        if (rule.entropy && entropy(secret) < rule.entropy) {
          continue;
        }
        expect(
          found.some(
            (f) =>
              f.rule === `gitleaks/${rule.id}` &&
              input.slice(f.start, f.end) === secret
          )
        ).toBe(true);
      }
    }
  }
});
