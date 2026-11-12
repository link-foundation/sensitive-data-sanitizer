// Issue 170: fuzzes the linear wrapped and percent scanners in src/encoded.js
// against the original regular expressions on short random inputs.
// Usage: node experiments/issue-170/encoded-equivalence.mjs [runs]
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

const ORIGINAL = {
  wrapped:
    /(?<![A-Za-z0-9_+/-])[A-Za-z0-9_+/-]{16,128}(?:\r?\n[A-Za-z0-9_+/-]{1,128})+={0,2}(?![A-Za-z0-9_+/-])/g,
  percent: /(?:[^\s"'<>?=&:/]{0,128}%[\da-fA-F]{2})+(?:[^\s"'<>?=&:/]{0,128})/g,
};
// Expose the private scanners through a temporary copy of the module.
const source = new URL('../../src/encoded.js', import.meta.url);
const copy = new URL('../../src/.issue-170-encoded.js', import.meta.url);
writeFileSync(
  fileURLToPath(copy),
  `${readFileSync(source, 'utf8')}\nexport { wrappedAt, percentMatches };\n`
);
let scanners;
try {
  scanners = await import(pathToFileURL(fileURLToPath(copy)).href);
} finally {
  rmSync(fileURLToPath(copy));
}
const linear = {
  *wrapped(text) {
    let from = 0;
    let match;
    while ((match = scanners.wrappedAt(text, from))) {
      yield match;
      from = match.index + match[0].length;
    }
  },
  percent: scanners.percentMatches,
};

const runs = Number(process.argv[2] ?? 200000);
const alphabets = {
  wrapped: ['A', 'b', '9', '+', '-', '=', '\n', '\r\n', ' ', '.', '"'],
  percent: ['%', '4', '1', 'f', 'g', 'a', ' ', '/', '=', '"', '\n', 'Z'],
};
let random = 170;
const next = () => {
  random = (random * 1103515245 + 12345) % 2147483648;
  return random / 2147483648;
};
let differences = 0;
const matched = { wrapped: 0, percent: 0 };
for (const name of ['wrapped', 'percent']) {
  const alphabet = alphabets[name];
  for (let i = 0; i < runs; i++) {
    // Long same-character stretches exercise the 16 and 128 bounds.
    const parts = [];
    const count = 1 + Math.floor(next() * 12);
    for (let j = 0; j < count; j++) {
      const unit = alphabet[Math.floor(next() * alphabet.length)];
      const repeat = next() < 0.2 ? Math.floor(next() * 150) : 1;
      parts.push(unit.repeat(repeat));
    }
    const text = parts.join('');
    const want = [...text.matchAll(ORIGINAL[name])].map(
      (m) => `${m.index}:${m[0]}`
    );
    const got = [...linear[name](text)].map((m) => `${m.index}:${m[0]}`);
    matched[name] += want.length;
    if (want.join('|') !== got.join('|')) {
      differences++;
      if (differences <= 5) {
        console.log(name, JSON.stringify(text), want, got);
      }
    }
  }
}
console.log(
  `runs=${runs * 2} matched=${JSON.stringify(matched)} differences=${differences}`
);
