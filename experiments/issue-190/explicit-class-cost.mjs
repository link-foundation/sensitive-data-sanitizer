import { performance } from 'node:perf_hooks';
// #189: is the cost the property lookup or the class size?
const re = /[\p{L}\p{M}\p{N}_]/u;
const ranges = [];
let start = -1;
for (let cp = 0; cp <= 0x10ffff; cp++) {
  const inside = re.test(String.fromCodePoint(cp));
  if (inside && start < 0) {
    start = cp;
  }
  if (!inside && start >= 0) {
    ranges.push([start, cp - 1]);
    start = -1;
  }
}
const hex = (cp) => `\\u{${cp.toString(16)}}`;
const explicit = `[${ranges.map(([a, b]) => (a === b ? hex(a) : `${hex(a)}-${hex(b)}`)).join('')}]`;
const bmp = ranges.filter(([a]) => a < 0x10000);
console.log(
  'ranges',
  ranges.length,
  'bmp',
  bmp.length,
  'source chars',
  explicit.length
);
const N = 200;
const text = 'текст номер 1 без имен';
for (const [label, cls] of [
  ['property', '[\\p{L}\\p{M}\\p{N}_]'],
  ['explicit', explicit],
]) {
  const res = Array.from(
    { length: N },
    (_, i) => new RegExp(`(?<!${cls})Имя${i}ов(?!${cls})`, 'giu')
  );
  const t = performance.now();
  for (const r of res) {
    r.exec(text);
  }
  console.log(label, (((performance.now() - t) / N) * 1000).toFixed(0), 'µs');
}
