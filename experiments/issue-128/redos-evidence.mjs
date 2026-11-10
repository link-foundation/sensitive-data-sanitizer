// CodeQL js/polynomial-redos: `[ \t]*X?[ \t]*` lets a tab run split between two
// quantifiers. Times the old and rewritten shapes on the same tab run.
// Run: node experiments/issue-128/redos-evidence.mjs [tabs]
import { performance } from 'node:perf_hooks';

const tabs = Number(process.argv[2] ?? 20000);
const shapes = {
  old: /(?:SSN)[ \t]*(?:[:#]|is)?[ \t]*(\d{3}[ .-]?\d{2}[ .-]?\d{4})/giu,
  rewritten:
    /(?:SSN)[ \t]*(?:(?:[:#]|is)[ \t]*)?(\d{3}[ .-]?\d{2}[ .-]?\d{4})/giu,
};
const text = `SSN${'\t'.repeat(tabs)}x`;
for (const [name, regex] of Object.entries(shapes)) {
  const start = performance.now();
  [...text.matchAll(regex)];
  console.log(name, `${Math.round(performance.now() - start)} ms`);
  console.log(
    ' ',
    [...'SSN is 987-65-4321 SSN:\t987654321'.matchAll(regex)].map((m) => m[1])
  );
}
