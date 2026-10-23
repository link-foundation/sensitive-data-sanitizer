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

// Assemble the synthetic key so repository push protection does not treat a
// literal provider-shaped regression fixture as an accidentally committed key.
const authress = `scauth_12345.abcd.acc_1234567890.${'AbCd0123456789ef'.repeat(2)}`;
const cases = [
  ['authress-service-client-access-key', authress],
  ['atlassian-api-token', 'JIRA = "Ab1cD2eF3gH4iJ5kL6mNabcd"'],
  [
    'atlassian-api-token',
    `ATATT3${'Ab1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uVxYzK'.repeat(6).slice(0, 186)}`,
  ],
  ['etsy-access-token', 'etsy = "Ab1cD2eF3gH4iJ5kL6mN7oP8"'],
  ['new-relic-user-api-key', `newrelic = "NRAK-${'Ab1cD2eF3'.repeat(3)}"`],
  [
    'okta-access-token',
    `okta = "00${'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN'}"`,
  ],
  ['snyk-api-token', 'snyk-token = "1234abcd-ab12-cd34-ef56-123456abcdef"'],
  ['sonar-api-token', `sonar_token = "${'abcdef1234'.repeat(4)}"`],
];
for (const [id, credential] of cases) {
  it(`keeps ${id} (${credential.slice(0, 10)}) inside long surrounding records`, () => {
    const input = `${'🙂 JIRA etsy okta '.repeat(70) + credential}\n${'A'.repeat(2000)}`;
    const rule = gitleaksRules.find((entry) => entry.id === id);
    const pattern = new RE2(rule.regex, 'gu');
    const match = pattern.exec(input);
    expect(Boolean(match)).toBe(true);
    const secret = rule.secretGroup
      ? match[rule.secretGroup]
      : (match.slice(1).find(Boolean) ?? match[0]);
    const found = [];
    detectGitleaks(input, (finding) => found.push(finding));
    expect(
      found.some(
        (finding) =>
          finding.rule === `gitleaks/${id}` &&
          input.slice(finding.start, finding.end) === secret
      )
    ).toBe(true);
  });
}

it('scans complete records larger than the WASM heap without truncating credentials', () => {
  const secret = 'AbCd0123456789ef'.repeat(70000);
  const input = `🙂 ext ${'A'.repeat(9600000)}\n${authress}\npassword = "${secret}"\n`;
  const found = [];
  detectGitleaks(input, (finding) => found.push(finding));
  expect(
    found.some(
      (f) =>
        f.rule === 'gitleaks/generic-api-key' &&
        input.slice(f.start, f.end) === secret
    )
  ).toBe(true);
  expect(
    found.some(
      (f) =>
        f.rule === 'gitleaks/authress-service-client-access-key' &&
        input.slice(f.start, f.end) === authress
    )
  ).toBe(true);
});
