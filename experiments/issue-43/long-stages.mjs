import { performance } from 'node:perf_hooks';
import { nativeDetect } from '../../src/detection.js';
import { projectText } from '../../src/projection.js';
import { decodedRuns } from '../../src/encoded.js';
import { serviceRules } from '../../src/rules.js';
import { detectContext } from '../../src/context.js';
import { detectPersonal } from '../../src/personal.js';
import { detectCatalog } from '../../src/entities.js';
import { detectIdentity } from '../../src/identity.js';
import { detectNational } from '../../src/national.js';
import { detectPersonalContext } from '../../src/personal-context.js';
import { detectCredentialFormats } from '../../src/credentials.js';
import { detectGitleaks } from '../../src/gitleaks.js';
const size = Number(process.argv[2] ?? 15700000);
if (!Number.isSafeInteger(size) || size < 1 || size > 16000000) {
  throw new Error('bounded input required');
}
const text =
  process.argv[3] === 'ordinary'
    ? 'ordinary log record\n'.repeat(Math.ceil(size / 20)).slice(0, size)
    : 'A'.repeat(size);
for (const [name, detect] of [
  ...serviceRules.map(([name, regex]) => [
    name,
    () => [...text.matchAll(regex)],
  ]),
  ...Object.entries({
    detectContext,
    detectPersonal,
    detectCatalog,
    detectIdentity,
    detectNational,
    detectPersonalContext,
    detectCredentialFormats,
    detectGitleaks,
  }).map(([name, fn]) => [name, () => fn(text, () => {})]),
  ['projection', () => projectText(text)],
  ['decoded', () => [...decodedRuns(text)]],
  ['native', () => nativeDetect(text, {}, () => {})],
]) {
  const start = performance.now();
  try {
    detect();
    console.log(name, performance.now() - start);
  } catch (error) {
    console.log(name, error.stack);
  }
}
