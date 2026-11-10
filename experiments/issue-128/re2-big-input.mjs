// Does re2-wasm's fixed 16 MiB heap still fit an input after N bundled rules
// are compiled? Run: node experiments/issue-128/re2-big-input.mjs <rules> <MiB>
import { RE2 } from 're2-wasm';
import { betterleaksRules, gitleaksRules } from '../../src/gitleaks.js';

const n = Number(process.argv[2]);
const mib = Number(process.argv[3] ?? 4);
const rules = [...gitleaksRules, ...betterleaksRules]
  .filter((rule) => rule.regex)
  .slice(0, n);
const kept = rules.map((rule) => new RE2(rule.regex, 'gu'));
const text = 'key = value aaaa\n'.repeat(Math.floor((mib * 1024 * 1024) / 17));
try {
  for (const pattern of kept.slice(0, 5)) {
    pattern.lastIndex = 0;
    pattern.exec(text);
  }
  console.log(`${n} rules, ${mib} MiB: ok`);
} catch (error) {
  console.log(`${n} rules, ${mib} MiB: ${String(error).slice(0, 60)}`);
}
