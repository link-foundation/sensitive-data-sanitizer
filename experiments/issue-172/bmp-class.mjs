import { performance } from 'node:perf_hooks';
// Does a BMP-only spelling of [\p{L}\p{N}] (explicit ranges, no astral code
// points) stay a simple loop on two-byte strings under the `u` flag, while an
// astral letter is still accepted by a separate alternative? (issue 172)
// Usage: node bmp-class.mjs [MiB]
const mib = Number(process.argv[2] ?? 8);
function bmpClass(property) {
  const test = new RegExp(`^${property}$`, 'u');
  const ranges = [];
  for (let c = 0; c <= 0xffff; c++) {
    if (c >= 0xd800 && c <= 0xdfff) {
      continue;
    }
    if (!test.test(String.fromCharCode(c))) {
      continue;
    }
    const last = ranges.at(-1);
    if (last && last[1] === c - 1) {
      last[1] = c;
    } else {
      ranges.push([c, c]);
    }
  }
  const hex = (c) => `\\u${c.toString(16).padStart(4, '0')}`;
  return ranges
    .map(([a, b]) => (a === b ? hex(a) : `${hex(a)}-${hex(b)}`))
    .join('');
}
const ln = bmpClass('[\\p{L}\\p{N}]');
const lun = bmpClass('[\\p{Ll}\\p{Lu}\\p{N}]');
const astral = (p) => `(?![\\0-\\uffff])${p}`;
const word = `(?:[${ln}]|${astral('[\\p{L}\\p{N}]')})`;
console.log('class length', ln.length, lun.length);
const variants = {
  'bmp [..]+ :': new RegExp(`[${ln}]+:`, 'uy'),
  'bmp [..]*? Secret': new RegExp(`[${lun}]*?Secret`, 'uy'),
  'split [bmp]*(?:astral[bmp]*)* :': new RegExp(
    `[${ln}]*(?:${astral('[\\p{L}\\p{N}]')}[${ln}]*)*:`,
    'uy'
  ),
  'split lazy [bmp]*?(?:astral[bmp]*?)*? Secret': new RegExp(
    `[${lun}]*?(?:${astral('[\\p{Ll}\\p{Lu}\\p{N}]')}[${lun}]*?)*?Secret`,
    'uy'
  ),
  'alt (?:bmp|astral)+ :': new RegExp(`${word}+:`, 'uy'),
};
for (const tail of [' —:\n', 'Secret:\n—', '𝐀:\n—']) {
  const text = 'A'.repeat(mib * 1024 * 1024) + tail;
  for (const [name, re] of Object.entries(variants)) {
    const t = performance.now();
    let r;
    try {
      re.lastIndex = 0;
      r = re.exec(text)?.[0].length ?? 'no match';
    } catch (e) {
      r = e.message;
    }
    console.log(
      JSON.stringify(tail),
      name,
      r,
      Math.round(performance.now() - t),
      'ms'
    );
  }
}
// astral letters still work
console.log(
  new RegExp(`^(?:[${ln}]+|${astral('[\\p{L}\\p{N}]')})+$`, 'u').test('ab𝐀𠀀c')
);
