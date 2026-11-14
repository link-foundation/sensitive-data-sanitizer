// Lists code points that the `iu` RegExp flags treat as equal to a "safe"
// anchor character but whose String#toLowerCase() differs from it.
const safe = [
  ...'abcdefghijklmnopqrstuvwxyz0123456789абвгдеёжзийклмнопрстуфхцчшщъыьэюя.-\'"«»',
];
const any = new RegExp(
  `^[${safe.map((c) => c.replace(/[\]\\^-]/g, '\\$&')).join('')}]$`,
  'iu'
);
const out = [];
let shrink = 0;
const grow = [];
for (let cp = 0; cp <= 0x10ffff; cp++) {
  if (cp >= 0xd800 && cp <= 0xdfff) {
    continue;
  }
  const ch = String.fromCodePoint(cp);
  const lower = ch.toLowerCase();
  if (lower.length < ch.length) {
    shrink++;
  }
  if (lower.length > ch.length) {
    grow.push(cp.toString(16));
  }
  if (!any.test(ch)) {
    continue;
  }
  const folded = lower.replace('ё', 'е');
  const target = safe.find((s) =>
    new RegExp(`^${s.replace(/[.\\]/g, '\\$&')}$`, 'iu').test(ch)
  );
  if (folded !== target.replace('ё', 'е')) {
    out.push([cp.toString(16), ch, lower, target]);
  }
}
console.log('exceptions', out);
console.log('shrinking lowercase', shrink, 'growing', grow);
