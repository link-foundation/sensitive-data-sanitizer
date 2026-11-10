import { createSyncSanitizer, redact } from '../../src/index.js';
const inputs = [
  '<pre>-----BEGIN RSA PRIVATE KEY-----<br>MIIEpAIBAAKCAQEA04up8h<br>-----END RSA PRIVATE KEY-----</pre>',
  '-----BEGIN PRIVATE KEY-----this is not a private key-----END PRIVATE KEY-----',
];
for (const input of inputs) {
  const engine = createSyncSanitizer();
  try {
    console.log(JSON.stringify({ input, result: engine.sanitize(input).text }));
  } catch (error) {
    const findings = engine.inspect(input);
    console.log(
      JSON.stringify({
        input,
        code: error.code,
        findings,
        redacted: redact(input, findings),
      })
    );
  }
}
