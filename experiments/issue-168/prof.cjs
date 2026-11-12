// Usage: node prof.cjs <dir>  — prints self and inclusive sample counts.
const fs = require('fs');
const dir = process.argv[2];
const p = JSON.parse(fs.readFileSync(`${dir}/${fs.readdirSync(dir)[0]}`));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) {
  for (const c of n.children ?? []) {
    parent.set(c, n.id);
  }
}
const name = (n) =>
  `${n.callFrame.functionName} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`.slice(
    0,
    100
  );
const self = new Map(),
  incl = new Map();
for (const s of p.samples) {
  const seen = new Set();
  let id = s;
  self.set(name(byId.get(s)), (self.get(name(byId.get(s))) ?? 0) + 1);
  while (id !== undefined) {
    const k = name(byId.get(id));
    if (!seen.has(k)) {
      seen.add(k);
      incl.set(k, (incl.get(k) ?? 0) + 1);
    }
    id = parent.get(id);
  }
}
const top = (m) =>
  [...m]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map((x) => `${x[1]}\t${x[0]}`)
    .join('\n');
console.log(
  'total samples',
  p.samples.length,
  `\n-- self\n${top(self)}\n-- inclusive\n${top(incl)}`
);
