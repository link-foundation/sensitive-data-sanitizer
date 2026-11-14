// Like fold-exceptions.mjs, for a wider anchor alphabet: printable ASCII,
// Latin-1, Latin Extended-A/B, Greek, basic Cyrillic and modifier quotes.
const ranges = [
  [0x21, 0x7e],
  [0xa1, 0x24f],
  [0x2b9, 0x2ba],
  [0x400, 0x45f],
  [0x2019, 0x2019],
];
const cands = [];
for (const [a, b] of ranges) {
  for (let cp = a; cp <= b; cp++) {
    cands.push(String.fromCodePoint(cp));
  }
}
const esc = (c) => c.replace(/[\]\\^\-[]/g, '\\$&');
const any = new RegExp(`^[${cands.map(esc).join('')}]$`, 'iu');
const fold = (c) => {
  const l = c.toLowerCase();
  return l.length === c.length ? l.replace('ё', 'е').replace('ſ', 's') : null;
};
const exceptions = new Map();
const unsafe = new Set();
for (let cp = 0; cp <= 0x10ffff; cp++) {
  if (cp >= 0xd800 && cp <= 0xdfff) {
    continue;
  }
  const ch = String.fromCodePoint(cp);
  if (!any.test(ch)) {
    continue;
  }
  const targets = cands.filter((c) =>
    new RegExp(`^[${esc(c)}]$`, 'iu').test(ch)
  );
  const folds = new Set(targets.map(fold));
  if (folds.has(null) || folds.size > 1) {
    targets.forEach((t) => unsafe.add(t));
    continue;
  }
  const [f] = folds;
  if (fold(ch) !== f) {
    exceptions.set(ch, f);
  }
}
console.log(
  'unsafe',
  [...unsafe].map((c) => `${c} U+${c.codePointAt(0).toString(16)}`)
);
console.log(
  'exceptions',
  [...exceptions].map(
    ([x, f]) => `U+${x.codePointAt(0).toString(16)} ${x}→${f}`
  )
);
