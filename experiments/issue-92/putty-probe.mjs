// Finite adversarial fixture. The parent test imposes a time and heap bound.
import { detectCredentialFormats } from '../../src/credentials.js';
const input = 'PuTTY-User-Key-File-2:'.repeat(30_000);
if (process.argv.includes('--legacy')) {
  const regex =
    /PuTTY-User-Key-File-[23]:[^\r\n]*(?:\r\n|\r|\n)[\s\S]*?(?:Private-MAC:[ \t]*[a-fA-F0-9]+|$)/g;
  console.log([...input.matchAll(regex)].length);
} else {
  let matches = 0;
  detectCredentialFormats(input, () => matches++);
  console.log(matches);
}
