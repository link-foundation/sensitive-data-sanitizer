// Compares credentials-only and full output on Authorization edge cases.
import { createSyncSanitizer } from '../../src/credentials-entry.js';
import { createSanitizer } from '../../src/index.js';
const s = createSyncSanitizer({ credentialsOnly: true });
const full = createSanitizer();
const inputs = [
  '`Authorization: token`',
  '``Authorization: Bearer `x` <token>`` ok',
  '`Authorization: Digest username="a", nonce="n", response="6629fae49393a05397450978507c4ef1"` done',
  '`Authorization: Digest username=a, response=6629fae49393a05397450978507c4ef1` done',
  'curl -H "Authorization: Bearer abcdefghijklmnopqrstuvwx1234" `x`',
  'Authorization: Bearer abc`def`ghijklmnop1234',
  '`Proxy-Authorization: Basic dXNlcjpwYXNzd29yZA==` header',
];
for (const input of inputs) {
  console.log(
    JSON.stringify(input),
    '\n  c=>',
    JSON.stringify(s.sanitize(input).text),
    '\n  f=>',
    JSON.stringify((await full.sanitize(input)).text)
  );
}
