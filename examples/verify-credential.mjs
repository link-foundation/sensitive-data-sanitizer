// Explicit network opt-in: node examples/verify-credential.mjs github --enable
import { createCredentialVerifier } from '../src/index.js';
const token = process.env.CREDENTIAL_TO_CHECK;
if (!token) {
  throw new Error(
    'Set CREDENTIAL_TO_CHECK privately before running this example'
  );
}
const check = createCredentialVerifier({
  enabled: process.argv.includes('--enable'),
  maxChecks: 1,
});
console.log(await check({ provider: process.argv[2] ?? 'github', token }));
