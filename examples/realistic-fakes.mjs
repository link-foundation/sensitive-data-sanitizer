import { randomBytes } from 'node:crypto';
import { createSanitizer } from '../src/index.js';

// Persist a private key outside published logs when stable identities are needed.
const key = process.env.SANITIZER_FAKE_KEY ?? randomBytes(32).toString('hex');
const sanitizer = createSanitizer({ transformation: { mode: 'fake', key } });
const input = [
  'Applicant: Marina Kovaleva',
  'born on 07/12/1985',
  'PNR K7QWZP; phone +1 (212) 234-5678',
  'email marina@private.org; password=short-private',
].join('\n');
const result = await sanitizer.sanitize(input);
console.log(result.text);
console.log(
  'Generated fake findings:',
  result.findings.filter((f) => f.faked).length
);
