import {
  createSanitizer,
  createGitleaksDetector,
  createTrufflehogDetector,
} from '../src/index.js';
import { join } from 'node:path';

const directory = process.argv[2];
const secret = `ghp_${'Az19Bc28De37Fg46Hi55Jk64Lm73No82Pq91'}`;
for (const [name, factory] of [
  ['gitleaks', createGitleaksDetector],
  ['trufflehog', createTrufflehogDetector],
]) {
  const detector = factory({ command: join(directory, name) });
  if (!(await detector.detect(secret)).length) {
    throw new Error(`Expected independent ${name} detection.`);
  }
  const engine = createSanitizer({ detectors: [detector] });
  for (const text of [
    secret,
    Buffer.from(secret).toString('base64'),
    'password=short',
  ]) {
    try {
      const result = await engine.sanitize(text);
      console.log({
        name,
        encoding: text === secret ? 'plain' : 'other',
        output: result.text,
        rules: result.findings.map((f) => f.rule),
      });
    } catch (error) {
      console.log({ name, error: error.code });
      process.exitCode = 1;
    }
  }
}
