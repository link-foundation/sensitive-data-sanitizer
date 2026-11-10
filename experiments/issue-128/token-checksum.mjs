#!/usr/bin/env node
// Shows which findings and confidences a checksum-valid and a checksum-invalid
// GitHub/npm token receive. Tokens are generated at runtime.
import { inspect } from '../../src/index.js';
import { tokenWithChecksum } from '../../src/token-checksum.js';

const body = 'aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW1';
for (const prefix of ['ghp', 'gho', 'ghs', 'npm']) {
  const valid = tokenWithChecksum(`${prefix}_`, body);
  const invalid = `${valid.slice(0, -1)}${valid.at(-1) === 'A' ? 'B' : 'A'}`;
  for (const [label, token] of [
    ['valid', valid],
    ['invalid', invalid],
  ]) {
    const findings = await inspect(`token=${token}`);
    console.log(
      prefix,
      label.padEnd(7),
      findings.map((f) => `${f.rule}:${f.confidence}`).join(', ')
    );
  }
}
