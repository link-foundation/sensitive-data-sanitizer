// Features matched against competitors in issue 128. Run with:
//   node examples/competitor-features.mjs
// Token-shaped values are built at runtime so the repository holds no literal.
import { randomBytes } from 'node:crypto';
import {
  createPatternDetector,
  decrypt,
  sanitize,
  inspect,
  toSarif,
  tokenChecksum,
  tokenWithChecksum,
} from '../src/index.js';

// Presidio allow_list / Google exclusion rule: keep reviewed values.
console.log(
  sanitize('Contact support@example.org or alice@private.test', {
    allowList: [/.+@example\.org/],
  }).text
);

// Google characterMaskConfig / Presidio mask operator.
console.log(
  sanitize('Card 4111-1111-1111-1111', {
    transformation: { mode: 'mask', char: '#', ignore: '-', count: 12 },
  }).text
);

// Google CryptoDeterministicConfig / Presidio encrypt operator.
const key = randomBytes(24).toString('base64');
const encrypted = sanitize('Mail alice@private.test', {
  transformation: { mode: 'encrypt', key },
}).text;
console.log(encrypted, '→', decrypt(encrypted, key));

// Presidio PatternRecognizer / Google custom infoType with a hotword rule.
const mrn = createPatternDetector([
  {
    type: 'MEDICAL_RECORD',
    category: 'personal',
    patterns: [{ regex: /\bMRN-\d{6}\b/g, confidence: 0.4 }],
    context: ['medical record'],
  },
]);
console.log(sanitize('medical record MRN-123456', { detectors: [mrn] }).text);

// Kingfisher-style offline checksum: confidence 0.99 for a valid token.
const token = tokenWithChecksum(['gh', 'p_'].join(''), 'a'.repeat(30));
console.log('checksum valid:', tokenChecksum(token));
const line = `GITHUB_TOKEN=${token}`;
const findings = inspect(line);
console.log(findings.map((f) => [f.type, f.rule, f.confidence]));

// Gitleaks / TruffleHog SARIF output for code scanning, without values.
const sarif = toSarif([{ path: '.env', findings }], { version: 'example' });
console.log(JSON.stringify(sarif.runs[0].results[0].locations[0]));
