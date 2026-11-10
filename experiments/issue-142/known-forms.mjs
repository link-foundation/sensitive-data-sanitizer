// Hex and base64 forms of short known secrets (issue 140).
import { Buffer } from 'node:buffer';
import { createSyncSanitizer, inspect } from '../../src/index.js';
const secret = ['Pk7Rm2Qx', '9LwZaB8yCd4E'].join('');
for (const n of [4, 8, 12, 16, 20]) {
  const value = secret.slice(0, n);
  const s = createSyncSanitizer({
    credentialsOnly: true,
    preserveEncoding: true,
    transformation: { mode: 'hive-mask' },
    knownSecrets: [value],
  });
  const bytes = Buffer.from(value);
  for (const form of [
    bytes.toString('hex'),
    bytes.toString('hex').toUpperCase(),
    bytes.toString('base64'),
    bytes.toString('base64url'),
  ]) {
    const text = `x ${form} y`;
    console.log(
      n,
      JSON.stringify(text),
      '->',
      JSON.stringify(s.sanitize(text).text),
      inspect(text, { credentialsOnly: true, knownSecrets: [value] })
        .map((f) => `${f.rule}[${f.start},${f.end}]`)
        .join(' ')
    );
  }
}
