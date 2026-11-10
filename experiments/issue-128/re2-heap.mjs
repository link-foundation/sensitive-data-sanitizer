// How many bundled rule regexes fit in re2-wasm's fixed 16 MiB heap?
// Run: node experiments/issue-128/re2-heap.mjs [rounds]
import { RE2 } from 're2-wasm';
import { betterleaksRules, gitleaksRules } from '../../src/gitleaks.js';

const rules = [...gitleaksRules, ...betterleaksRules].filter((r) => r.regex);
const rounds = Number(process.argv[2] ?? 4);
const kept = [];
let count = 0;
try {
  for (let round = 0; round < rounds; round++) {
    for (const rule of rules) {
      kept.push(new RE2(rule.regex, 'gu'));
      count++;
    }
    console.log(`round ${round + 1}: ${count} live RE2 objects`);
  }
} catch (error) {
  console.log(
    `failed after ${count} live RE2 objects: ${String(error).slice(0, 120)}`
  );
}
