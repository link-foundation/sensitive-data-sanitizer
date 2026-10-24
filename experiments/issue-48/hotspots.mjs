import { readFileSync } from 'node:fs';
const profile = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const counts = new Map();
for (const sample of profile.samples) {
  counts.set(sample, (counts.get(sample) ?? 0) + 1);
}
console.log(
  profile.nodes
    .map((n) => ({
      samples: counts.get(n.id) ?? 0,
      name: n.callFrame.functionName,
      url: n.callFrame.url,
      line: n.callFrame.lineNumber + 1,
    }))
    .sort((a, b) => b.samples - a.samples)
    .slice(0, 25)
);
