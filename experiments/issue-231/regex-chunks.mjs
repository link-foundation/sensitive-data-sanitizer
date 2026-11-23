// Compare the native BMP loop with the sanitizer's version on a two-byte
// string. Run with a V8 heap cap and stack cap:
// node --max-old-space-size=256 --stack_size=1024 experiments/issue-231/regex-chunks.mjs
import { unicodeRun } from '../../src/unicode-runs.js';

const size = (process.argv.includes('--32-mib') ? 32 : 8) * 1024 * 1024;
const text = `${'A'.repeat(size)}: —`;
for (const [name, pattern] of [
  ['native BMP loop', /^[A-Z]+:/u],
  [
    'sanitizer Unicode loop',
    new RegExp(`^${unicodeRun('[\\p{L}\\p{N}]')}:`, 'u'),
  ],
]) {
  try {
    console.log(name, pattern.exec(text)?.[0].length);
  } catch (error) {
    console.log(name, error.message);
  }
}
